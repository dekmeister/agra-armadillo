// Flight Autonomy engine — data-driven from the body profile, never scripted per
// level (docs/04). Implements the Tier-1 interactions exercised by level 1.2:
//   • Control Mode Authorization (VI §1.2.2.4): advertise capability + AVAILABLE at boot.
//   • Receive Control Request (VI §1.2.2.7): ACQUIRE → APPROVED (instant for AX-01,
//     PENDING-then-APPROVED when the body sets approvalLatencyTicks > 0).
//   • Publish Control Status (VI §1.2.6.2): FA always Primary; MA at most Secondary.
//   • Control by HSA/CSA Command (VI §1.2.2.2): validate; ignore if MA is not the
//     secondary controller (fidelity lie #8 — FA isn't listening, no NACK invented).
//   • Receive Vehicle State Data (VI §1.2.6.8): periodic position + activity reports.
import { type BodyProfile, type CapabilityProfile, findCapability } from "../body.ts";
import type { ActiveThreat } from "../level/events.ts";
import type { CurveDef, RouteDef } from "../level/types.ts";
import type {
  MA_ControlRequestMT,
  MA_FlightCommandMT,
  MA_MissionPlanActivationCommandMT,
  MA_MissionPlanActivationCommandStatusMT,
  MA_RoutePlanMT,
} from "../messages/index.ts";
import {
  DELIVERED,
  type Disposition,
  FA_SYSTEM_ID,
  IGNORED_NOT_CONTROLLER,
  MA_SYSTEM_ID,
  type Message,
  msg,
} from "../types.ts";
import {
  bearingTo,
  distance,
  type FlightTarget,
  headingAwayFrom,
  pathEntersZone,
  turnToward,
  type VehicleState,
} from "../vehicle/pointmass.ts";
import { validateCurveCommand, validateFlightCommand } from "./validator.ts";

export interface FaState {
  readonly booted: boolean;
  /** capabilityId -> systemId of the secondary controller (absent = none). */
  readonly secondaryControllers: Readonly<Record<string, string>>;
  /** capabilityId -> ticks remaining before a PENDING request becomes APPROVED. */
  readonly pendingApprovals: Readonly<Record<string, number>>;
  /** capabilityId -> reason it is currently unavailable (absent = available).
   *  Set by a `capability-unavailable` mission event; FA stops accepting commands. */
  readonly unavailableCaps: Readonly<Record<string, "TEMPORARILY_UNAVAILABLE" | "UNAVAILABLE">>;
  readonly positionTicker: number;
  readonly activityTicker: number;
  readonly navigationTicker: number;
  readonly activeActivityId: string | null;
  /** Threat id FA is currently holding the aircraft clear of (null = no active fault).
   *  While set, FA flies a fly-away vector and rejects any command still entering a threat. */
  readonly collisionFault: string | null;
  /** Monotonic counter for FaultID generation (deterministic, no RNG). */
  readonly faultSeq: number;
  /** RoutePlanID -> upload/activation state machine (levels 2.1 / 2.3). */
  readonly routePlans: Readonly<Record<string, RoutePlanState>>;
  /** The one route currently EXECUTING (FA steers the vehicle along it); null = none. */
  readonly executingRouteId: string | null;
  /** Active curve-following command (level 2.4); null = none. */
  readonly activeCurve: CurveExecState | null;
}

/** Upload/activation state of one route plan. `activationState` is a PlanActivationStateEnum
 *  literal; `executionState` is a PlanExecutionStateEnum literal once ACTIVATED. */
export interface RoutePlanState {
  readonly activationState: string;
  /** Whether the MA_RoutePlanMT data has been received (gates UPLOAD). */
  readonly uploaded: boolean;
  readonly executionState: string | null;
  /** Index of the next route leg FA is flying (0..legs.length; ==legs.length ⇒ to loiter). */
  readonly waypointIndex: number;
}

/** Active curve-following execution (level 2.4). `status` is an MA_CurveStatusEnum literal. */
export interface CurveExecState {
  readonly status: string;
  readonly curvature: number;
  readonly speed?: number;
  readonly altitude?: number;
}

export function initFaState(): FaState {
  return {
    booted: true,
    secondaryControllers: {},
    pendingApprovals: {},
    unavailableCaps: {},
    positionTicker: 0,
    activityTicker: 0,
    navigationTicker: 0,
    activeActivityId: null,
    collisionFault: null,
    faultSeq: 0,
    routePlans: {},
    executingRouteId: null,
    activeCurve: null,
  };
}

export function isSecondaryController(fa: FaState, capabilityId: string): boolean {
  return fa.secondaryControllers[capabilityId] === MA_SYSTEM_ID;
}

// --- message builders -------------------------------------------------------

/** Availability a capability boots with (default AVAILABLE; a capability with a
 *  scheduled `capability-available` event boots TEMPORARILY_UNAVAILABLE — see initWorld). */
type Unavailable = Readonly<Record<string, "TEMPORARILY_UNAVAILABLE" | "UNAVAILABLE">>;

function capabilityAdvert(body: BodyProfile, unavailable: Unavailable = {}): Message[] {
  const out: Message[] = [];
  for (const cap of body.capabilities) {
    const p = cap.profile;
    out.push(
      msg("MA_FlightCapabilityMT", "FA", "MA", {
        CapabilityID: cap.id,
        CapabilityType: cap.type,
        ...(p.minAltitude !== undefined ? { MinAltitude: p.minAltitude } : {}),
        ...(p.maxAltitude !== undefined ? { MaxAltitude: p.maxAltitude } : {}),
        ...(p.minAirspeed !== undefined ? { MinAirspeed: p.minAirspeed } : {}),
        ...(p.maxAirspeed !== undefined ? { MaxAirspeed: p.maxAirspeed } : {}),
      }),
    );
    out.push(
      msg("MA_FlightCapabilityStatusMT", "FA", "MA", {
        CapabilityID: cap.id,
        Availability: unavailable[cap.id] ?? "AVAILABLE",
      }),
    );
  }
  return out;
}

function controlStatus(capabilityId: string, secondary: string | null): Message {
  return msg("ControlStatusMT", "FA", "MA", {
    CapabilityID: capabilityId,
    PrimaryController: FA_SYSTEM_ID,
    ...(secondary ? { SecondaryController: secondary } : {}),
  });
}

function approvalStatus(capabilityId: string, state: "APPROVED" | "PENDING" | "REJECTED"): Message {
  return msg("MA_ControlRequestStatusMT", "FA", "MA", {
    CapabilityID: capabilityId,
    ApprovalRequestProcessingState: state,
  });
}

/** Messages FA publishes at boot (enqueued at tick 0, delivered at tick 1). Caps in
 *  `unavailable` boot TEMPORARILY_UNAVAILABLE/UNAVAILABLE rather than AVAILABLE. */
export function faBootMessages(body: BodyProfile, unavailable: Unavailable = {}): Message[] {
  return capabilityAdvert(body, unavailable);
}

// --- per-tick phases --------------------------------------------------------

/** Phase A (before inbound): count down PENDING control requests; emit APPROVED + ControlStatus when due. */
export function faAdvanceApprovals(fa: FaState): { fa: FaState; outbound: Message[] } {
  const pending = { ...fa.pendingApprovals };
  const secondary = { ...fa.secondaryControllers };
  const outbound: Message[] = [];
  let changed = false;
  for (const capId of Object.keys(pending)) {
    const remaining = pending[capId]! - 1;
    if (remaining <= 0) {
      delete pending[capId];
      secondary[capId] = MA_SYSTEM_ID;
      outbound.push(approvalStatus(capId, "APPROVED"));
      outbound.push(controlStatus(capId, MA_SYSTEM_ID));
    } else {
      pending[capId] = remaining;
    }
    changed = true;
  }
  if (!changed) return { fa, outbound };
  return { fa: { ...fa, pendingApprovals: pending, secondaryControllers: secondary }, outbound };
}

export interface FaInboundResult {
  readonly fa: FaState;
  readonly outbound: Message[];
  readonly disposition: Disposition;
  /** Replace the vehicle target on an accepted command; undefined = leave unchanged. */
  readonly targetUpdate?: FlightTarget;
}

/** Phase B: FA processes one inbound message from MA. `dynamicEnvelope` carries any
 *  mid-mission envelope overrides (from `degrade-envelope` events); empty for static levels. */
export function faHandleInbound(
  body: BodyProfile,
  fa: FaState,
  message: Message,
  dynamicEnvelope: Readonly<Record<string, CapabilityProfile>> = {},
  vehicle?: VehicleState,
  threats: readonly ActiveThreat[] = [],
  routes: readonly RouteDef[] = [],
): FaInboundResult {
  switch (message.type) {
    case "MA_ControlRequestMT":
      return handleControlRequest(body, fa, message.payload as MA_ControlRequestMT);
    case "MA_FlightCommandMT":
      return handleFlightCommand(
        body,
        fa,
        message.payload as MA_FlightCommandMT,
        dynamicEnvelope,
        vehicle,
        threats,
      );
    case "MA_RoutePlanMT":
      return handleRoutePlan(fa, message.payload as MA_RoutePlanMT, routes);
    case "MA_MissionPlanActivationCommandMT":
      return handleActivationCommand(
        fa,
        message.payload as MA_MissionPlanActivationCommandMT,
        routes,
        vehicle,
      );
    default:
      return { fa, outbound: [], disposition: DELIVERED };
  }
}

function handleControlRequest(
  body: BodyProfile,
  fa: FaState,
  req: MA_ControlRequestMT,
): FaInboundResult {
  const capId = req.CapabilityID;
  const cap = findCapability(body, capId);

  if (req.RequestType === "RELEASE") {
    const secondary = { ...fa.secondaryControllers };
    delete secondary[capId];
    return {
      fa: { ...fa, secondaryControllers: secondary },
      outbound: [controlStatus(capId, null)],
      disposition: DELIVERED,
    };
  }

  // ACQUIRE
  if (!cap) {
    return { fa, outbound: [approvalStatus(capId, "REJECTED")], disposition: DELIVERED };
  }
  // FA isn't ready to authorize control of a capability it hasn't advertised AVAILABLE
  // (Control Mode Authorization, VI §1.2.2.4): an early ACQUIRE is REJECTED.
  if (fa.unavailableCaps[capId] !== undefined) {
    return { fa, outbound: [approvalStatus(capId, "REJECTED")], disposition: DELIVERED };
  }
  const latency = body.control.approvalLatencyTicks;
  if (latency <= 0) {
    return {
      fa: { ...fa, secondaryControllers: { ...fa.secondaryControllers, [capId]: MA_SYSTEM_ID } },
      outbound: [approvalStatus(capId, "APPROVED"), controlStatus(capId, MA_SYSTEM_ID)],
      disposition: DELIVERED,
    };
  }
  return {
    fa: { ...fa, pendingApprovals: { ...fa.pendingApprovals, [capId]: latency } },
    outbound: [approvalStatus(capId, "PENDING")],
    disposition: DELIVERED,
  };
}

function handleFlightCommand(
  body: BodyProfile,
  fa: FaState,
  cmd: MA_FlightCommandMT,
  dynamicEnvelope: Readonly<Record<string, CapabilityProfile>>,
  vehicle?: VehicleState,
  threats: readonly ActiveThreat[] = [],
): FaInboundResult {
  // A capability pulled mid-mission (capability-unavailable event) isn't listening
  // either — same silent drop as not-controller (no NACK invented; fidelity lie #8).
  if (fa.unavailableCaps[cmd.CapabilityID] !== undefined) {
    return { fa, outbound: [], disposition: IGNORED_NOT_CONTROLLER };
  }
  // FA isn't listening unless MA holds secondary control of this capability.
  if (!isSecondaryController(fa, cmd.CapabilityID)) {
    return { fa, outbound: [], disposition: IGNORED_NOT_CONTROLLER };
  }

  // A Curvature selects the CurveFollowing flight mode (level 2.4) — validated and flown
  // differently from an HSA vector. The presence of Curvature is the mode discriminator.
  if (cmd.Curvature !== undefined && cmd.CommandState !== "CANCEL") {
    return handleCurveCommand(body, fa, cmd, dynamicEnvelope[cmd.CapabilityID]);
  }

  // Collision hold: while FA is holding the aircraft clear of a threat, it accepts a
  // command only if the new vector also clears every threat; otherwise it rejects with
  // VIOLATION_AIR_TRAFFIC. A clear command yields control back (releases the hold).
  if (
    fa.collisionFault !== null &&
    body.collisionLookaheadTicks !== undefined &&
    vehicle &&
    cmd.CommandState !== "CANCEL"
  ) {
    const h = cmd.Heading ?? vehicle.heading;
    const s = cmd.Speed ?? vehicle.speed;
    const stillDangerous = threats.some((t) =>
      pathEntersZone(vehicle.x, vehicle.y, h, s, t.zone, body.collisionLookaheadTicks!),
    );
    if (stillDangerous) {
      const status = msg("MA_FlightCommandStatusMT", "FA", "MA", {
        CommandID: cmd.CommandID,
        CommandProcessingState: "REJECTED",
        ValidationResult: "VIOLATION_AIR_TRAFFIC",
      });
      return { fa, outbound: [status], disposition: DELIVERED };
    }
    fa = { ...fa, collisionFault: null }; // clear vector — hand control back
  }

  const outcome = validateFlightCommand(body, cmd, dynamicEnvelope[cmd.CapabilityID], vehicle);
  const status = msg("MA_FlightCommandStatusMT", "FA", "MA", {
    CommandID: cmd.CommandID,
    CommandProcessingState: outcome.accepted ? "ACCEPTED" : "REJECTED",
    ValidationResult: outcome.result,
  });

  if (!outcome.accepted) {
    return { fa, outbound: [status], disposition: DELIVERED };
  }

  const activeActivityId = fa.activeActivityId ?? "ACT-1";
  return {
    fa: { ...fa, activeActivityId },
    outbound: [status],
    disposition: DELIVERED,
    targetUpdate: outcome.target ?? {},
  };
}

// --- Curve following (level 2.4) -------------------------------------------

function handleCurveCommand(
  body: BodyProfile,
  fa: FaState,
  cmd: MA_FlightCommandMT,
  profileOverride?: CapabilityProfile,
): FaInboundResult {
  const outcome = validateCurveCommand(body, cmd, profileOverride);
  const status = msg("MA_FlightCommandStatusMT", "FA", "MA", {
    CommandID: cmd.CommandID,
    CommandProcessingState: outcome.accepted ? "ACCEPTED" : "REJECTED",
    ValidationResult: outcome.result,
  });
  if (!outcome.accepted) return { fa, outbound: [status], disposition: DELIVERED };

  const activeCurve: CurveExecState = {
    status: "START_CURVE_FOLLOWING",
    curvature: cmd.Curvature ?? 0,
    ...(cmd.Speed !== undefined ? { speed: cmd.Speed } : {}),
    ...(cmd.Altitude !== undefined ? { altitude: cmd.Altitude } : {}),
  };
  const target: FlightTarget = {
    ...(cmd.Speed !== undefined ? { speed: cmd.Speed } : {}),
    ...(cmd.Altitude !== undefined ? { altitude: cmd.Altitude } : {}),
  };
  return {
    fa: { ...fa, activeCurve },
    outbound: [status],
    disposition: DELIVERED,
    targetUpdate: target,
  };
}

// --- Route plan upload + activation (levels 2.1 / 2.3) ---------------------

function emptyRoutePlan(): RoutePlanState {
  return { activationState: "INACTIVE", uploaded: false, executionState: null, waypointIndex: 0 };
}

function activationStatus(
  commandId: string,
  state: MA_MissionPlanActivationCommandStatusMT["ActivationState"],
  processing: NonNullable<MA_MissionPlanActivationCommandStatusMT["CommandStatus"]>,
): Message {
  return msg("MA_MissionPlanActivationCommandStatusMT", "FA", "MA", {
    CommandID: commandId,
    ActivationState: state,
    CommandStatus: processing,
  });
}

/** Record a received route plan (gates the UPLOAD step). Unknown ids are ignored. */
function handleRoutePlan(
  fa: FaState,
  plan: MA_RoutePlanMT,
  routes: readonly RouteDef[],
): FaInboundResult {
  const id = plan.RoutePlanID;
  if (!routes.some((r) => r.id === id)) return { fa, outbound: [], disposition: DELIVERED };
  const cur = fa.routePlans[id] ?? emptyRoutePlan();
  return {
    fa: { ...fa, routePlans: { ...fa.routePlans, [id]: { ...cur, uploaded: true } } },
    outbound: [],
    disposition: DELIVERED,
  };
}

/** Drive the activation liturgy. A well-ordered step advances the plan state (COMPLETED);
 *  a step taken out of order replies a *_FAILED state. ACTIVATE starts route execution;
 *  DEACTIVATE while EXECUTING fails (VI §1.2.5.4). */
function handleActivationCommand(
  fa: FaState,
  cmd: MA_MissionPlanActivationCommandMT,
  routes: readonly RouteDef[],
  _vehicle?: VehicleState,
): FaInboundResult {
  const id = cmd.RoutePlanID;
  if (!routes.some((r) => r.id === id)) return { fa, outbound: [], disposition: DELIVERED };
  const rp = fa.routePlans[id] ?? emptyRoutePlan();

  type ActState = MA_MissionPlanActivationCommandStatusMT["ActivationState"];
  const advance = (state: ActState): FaInboundResult => ({
    fa: { ...fa, routePlans: { ...fa.routePlans, [id]: { ...rp, activationState: state } } },
    outbound: [activationStatus(cmd.CommandID, state, "COMPLETED")],
    disposition: DELIVERED,
  });
  const failState = (state: ActState): FaInboundResult => ({
    fa,
    outbound: [activationStatus(cmd.CommandID, state, "FAILED")],
    disposition: DELIVERED,
  });

  switch (cmd.ActivationCommand) {
    case "PREPARE_FOR_UPLOAD":
      return advance("READY_FOR_UPLOAD");
    case "UPLOAD":
      return rp.activationState === "READY_FOR_UPLOAD" && rp.uploaded
        ? advance("UPLOADED")
        : failState("UPLOAD_FAILED");
    case "PREPARE_FOR_ACTIVATION":
      return rp.activationState === "UPLOADED"
        ? advance("READY_FOR_ACTIVATION")
        : failState("PREPARATION_FOR_ACTIVATION_FAILED");
    case "ACTIVATE": {
      if (rp.activationState !== "READY_FOR_ACTIVATION") return failState("ACTIVATION_FAILED");
      const next: RoutePlanState = {
        ...rp,
        activationState: "ACTIVATED",
        executionState: "EXECUTING",
        waypointIndex: 0,
      };
      return {
        fa: { ...fa, routePlans: { ...fa.routePlans, [id]: next }, executingRouteId: id },
        outbound: [
          activationStatus(cmd.CommandID, "ACTIVATED", "COMPLETED"),
          msg("RoutePlanExecutionStatusMT", "FA", "MA", {
            RoutePlanID: id,
            PlanExecutionState: "EXECUTING",
          }),
        ],
        disposition: DELIVERED,
      };
    }
    case "DEACTIVATE":
      // Illegal while the route is running (VI §1.2.5.4) — the route keeps executing.
      if (rp.executionState === "EXECUTING") {
        return {
          fa,
          outbound: [
            activationStatus(cmd.CommandID, "DEACTIVATION_FAILED", "FAILED"),
            msg("RoutePlanExecutionStatusMT", "FA", "MA", {
              RoutePlanID: id,
              PlanExecutionState: "FAILED",
            }),
          ],
          disposition: DELIVERED,
        };
      }
      return failState("DEACTIVATION_FAILED");
    default:
      return { fa, outbound: [], disposition: DELIVERED };
  }
}

const LEG_ARRIVE_RADIUS = 50;

function legTarget(
  v: VehicleState,
  leg: { x: number; y: number; altitude?: number; speed?: number },
): FlightTarget {
  return {
    heading: bearingTo(v.x, v.y, leg.x, leg.y),
    ...(leg.altitude !== undefined ? { altitude: leg.altitude } : {}),
    ...(leg.speed !== undefined ? { speed: leg.speed } : {}),
  };
}

/**
 * Phase C: advance the EXECUTING route by steering the vehicle to its current leg, then
 * to the terminal loiter. On entering the loiter zone the route is COMPLETE and FA stops
 * steering (the vehicle dwells on its slow final leg, satisfying the hold). Pure; a no-op
 * when no route is executing.
 */
export function faAdvanceRoute(
  fa: FaState,
  vehicle: VehicleState,
  routes: readonly RouteDef[],
): { fa: FaState; outbound: Message[]; targetOverride?: FlightTarget } {
  const id = fa.executingRouteId;
  if (id === null) return { fa, outbound: [] };
  const rp = fa.routePlans[id];
  if (!rp || rp.executionState !== "EXECUTING") return { fa, outbound: [] };
  const route = routes.find((r) => r.id === id);
  if (!route) return { fa, outbound: [] };

  let waypointIndex = rp.waypointIndex;
  while (
    waypointIndex < route.legs.length &&
    distance(vehicle.x, vehicle.y, route.legs[waypointIndex]!.x, route.legs[waypointIndex]!.y) <=
      LEG_ARRIVE_RADIUS
  ) {
    waypointIndex += 1;
  }
  const withIndex = (next: RoutePlanState): FaState => ({
    ...fa,
    routePlans: { ...fa.routePlans, [id]: next },
  });

  if (waypointIndex < route.legs.length) {
    const faNext = waypointIndex === rp.waypointIndex ? fa : withIndex({ ...rp, waypointIndex });
    return {
      fa: faNext,
      outbound: [],
      targetOverride: legTarget(vehicle, route.legs[waypointIndex]!),
    };
  }

  const loiter = route.loiter;
  if (distance(vehicle.x, vehicle.y, loiter.x, loiter.y) <= loiter.radius) {
    const next: RoutePlanState = { ...rp, waypointIndex, executionState: "COMPLETE" };
    return {
      fa: { ...withIndex(next), executingRouteId: null },
      outbound: [
        msg("RoutePlanExecutionStatusMT", "FA", "MA", {
          RoutePlanID: id,
          PlanExecutionState: "COMPLETE",
        }),
      ],
    };
  }
  const faNext = waypointIndex === rp.waypointIndex ? fa : withIndex({ ...rp, waypointIndex });
  return { fa: faNext, outbound: [], targetOverride: legTarget(vehicle, loiter) };
}

/**
 * Phase C: advance an active curve-following command (level 2.4) by steering the vehicle
 * toward the terminal along a curvature-limited arc (per-tick heading change capped by the
 * commanded Curvature). On reaching the terminal zone the curve is CURVE_COMPLETED (a one-
 * shot activity report) and steering stops. Pure; a no-op when no curve is active.
 */
export function faAdvanceCurve(
  body: BodyProfile,
  fa: FaState,
  vehicle: VehicleState,
  curve: CurveDef | undefined,
): { fa: FaState; outbound: Message[]; targetOverride?: FlightTarget } {
  const ac = fa.activeCurve;
  if (!ac || curve === undefined || ac.status === "CURVE_COMPLETED") return { fa, outbound: [] };
  const term = curve.terminal;
  if (distance(vehicle.x, vehicle.y, term.x, term.y) <= term.radius) {
    return {
      fa: { ...fa, activeCurve: { ...ac, status: "CURVE_COMPLETED" } },
      outbound: [
        msg("MA_FlightActivityMT", "FA", "MA", {
          ActivityID: "CURVE-1",
          CurveStatus: "CURVE_COMPLETED",
        }),
      ],
    };
  }
  const speed = ac.speed ?? vehicle.speed;
  const perTickDeg = Math.min(ac.curvature * speed * (180 / Math.PI), body.flight.maxTurnRateDeg);
  const heading = turnToward(
    vehicle.heading,
    bearingTo(vehicle.x, vehicle.y, term.x, term.y),
    perTickDeg,
  );
  const faNext =
    ac.status === "START_CURVE_FOLLOWING"
      ? { ...fa, activeCurve: { ...ac, status: "CURVE_IN_PROGRESS" } }
      : fa;
  return {
    fa: faNext,
    outbound: [],
    targetOverride: {
      heading,
      ...(ac.speed !== undefined ? { speed: ac.speed } : {}),
      ...(ac.altitude !== undefined ? { altitude: ac.altitude } : {}),
    },
  };
}

/** Phase C (after inbound): periodic vehicle-state publication (fidelity lie #3, discrete ticks). */
export function faPublish(
  body: BodyProfile,
  fa: FaState,
  vehicle: VehicleState,
): { fa: FaState; outbound: Message[] } {
  const outbound: Message[] = [];
  const { positionIntervalTicks, activityIntervalTicks } = body.publish;

  let positionTicker = fa.positionTicker + 1;
  if (positionIntervalTicks > 0 && positionTicker >= positionIntervalTicks) {
    positionTicker = 0;
    outbound.push(
      msg("MA_PositionReportDetailedMT", "FA", "MA", {
        Longitude: vehicle.x,
        Latitude: vehicle.y,
        Altitude: vehicle.altitude,
        NavigationSolutionState: "GPS",
      }),
    );
  }

  let activityTicker = fa.activityTicker + 1;
  if (
    fa.activeActivityId !== null &&
    activityIntervalTicks > 0 &&
    activityTicker >= activityIntervalTicks
  ) {
    activityTicker = 0;
    outbound.push(
      msg("MA_FlightActivityMT", "FA", "MA", {
        ActivityID: fa.activeActivityId,
        Altitude: vehicle.altitude,
        Heading: vehicle.heading,
        Speed: vehicle.speed,
      }),
    );
  }

  // Endurance report — only for fuel-bearing bodies with a navigation interval set.
  let navigationTicker = fa.navigationTicker + 1;
  const navInterval = body.publish.navigationIntervalTicks ?? 0;
  if (
    body.fuel !== undefined &&
    vehicle.fuel !== undefined &&
    navInterval > 0 &&
    navigationTicker >= navInterval
  ) {
    navigationTicker = 0;
    const pct = body.fuel.capacity > 0 ? (vehicle.fuel / body.fuel.capacity) * 100 : 0;
    outbound.push(
      msg("NavigationReportMT", "FA", "MA", {
        Fuel: Math.round(vehicle.fuel),
        Percent: Math.round(pct),
      }),
    );
  }

  return { fa: { ...fa, positionTicker, activityTicker, navigationTicker }, outbound };
}

/**
 * Phase C′ (after publish, before integrate): collision-avoidance interrupt. On a
 * flinchy body, if the vehicle's intended vector (its target, or current heading if
 * none) would enter a threat zone within `collisionLookaheadTicks`, FA takes the
 * aircraft: it raises a CAUTION `MA_FaultMT` (once per fault) and overrides the target
 * to a fly-away heading. The hold persists (and re-issued dangerous commands are
 * rejected in handleFlightCommand) until MA commands a clear vector. Deterministic;
 * no-op on bodies without `collisionLookaheadTicks` or when there are no threats.
 */
export function faCollisionCheck(
  body: BodyProfile,
  fa: FaState,
  vehicle: VehicleState,
  threats: readonly ActiveThreat[],
): { fa: FaState; outbound: Message[]; targetOverride?: FlightTarget } {
  const lookahead = body.collisionLookaheadTicks;
  if (lookahead === undefined) return { fa, outbound: [] };
  if (threats.length === 0) {
    return fa.collisionFault !== null
      ? { fa: { ...fa, collisionFault: null }, outbound: [] }
      : { fa, outbound: [] };
  }
  // Only intervene once MA is actively flying a commanded vector — FA doesn't seize an
  // aircraft no one is steering toward a hazard (target null = no MA command in effect).
  if (vehicle.target === null) return { fa, outbound: [] };

  const h = vehicle.target.heading ?? vehicle.heading;
  const s = vehicle.target.speed ?? vehicle.speed;
  const danger = threats.find((t) => pathEntersZone(vehicle.x, vehicle.y, h, s, t.zone, lookahead));
  if (!danger) return { fa, outbound: [] };

  const outbound: Message[] = [];
  let next = fa;
  if (fa.collisionFault === null) {
    const faultId = `FAULT-${fa.faultSeq + 1}`;
    outbound.push(
      msg("MA_FaultMT", "FA", "MA", {
        FaultID: faultId,
        Severity: "CAUTION",
        FaultDescription:
          "Collision avoidance: commanded vector enters a hazard zone. FA holding clear.",
        CapabilityID: body.capabilities[0]?.id ?? "",
      }),
    );
    next = { ...fa, collisionFault: danger.id, faultSeq: fa.faultSeq + 1 };
  }
  return {
    fa: next,
    outbound,
    targetOverride: { heading: headingAwayFrom(vehicle.x, vehicle.y, danger.zone) },
  };
}
