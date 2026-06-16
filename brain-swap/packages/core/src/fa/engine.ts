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
import {
  DELIVERED,
  FA_SYSTEM_ID,
  IGNORED_NOT_CONTROLLER,
  MA_SYSTEM_ID,
  type Disposition,
  type Message,
  msg,
} from "../types.ts";
import type { FlightTarget, VehicleState } from "../vehicle/pointmass.ts";
import type { MA_ControlRequestMT, MA_FlightCommandMT } from "../messages/index.ts";
import { validateFlightCommand } from "./validator.ts";

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
  };
}

export function isSecondaryController(fa: FaState, capabilityId: string): boolean {
  return fa.secondaryControllers[capabilityId] === MA_SYSTEM_ID;
}

// --- message builders -------------------------------------------------------

function capabilityAdvert(body: BodyProfile): Message[] {
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
        Availability: "AVAILABLE",
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

function approvalStatus(
  capabilityId: string,
  state: "APPROVED" | "PENDING" | "REJECTED",
): Message {
  return msg("MA_ControlRequestStatusMT", "FA", "MA", {
    CapabilityID: capabilityId,
    ApprovalRequestProcessingState: state,
  });
}

/** Messages FA publishes at boot (enqueued at tick 0, delivered at tick 1). */
export function faBootMessages(body: BodyProfile): Message[] {
  return capabilityAdvert(body);
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
): FaInboundResult {
  switch (message.type) {
    case "MA_ControlRequestMT":
      return handleControlRequest(body, fa, message.payload as MA_ControlRequestMT);
    case "MA_FlightCommandMT":
      return handleFlightCommand(body, fa, message.payload as MA_FlightCommandMT, dynamicEnvelope, vehicle);
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
  if (body.fuel !== undefined && vehicle.fuel !== undefined && navInterval > 0 && navigationTicker >= navInterval) {
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
