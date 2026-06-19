// Body (airframe + FA) configuration shape. Bodies are pure data files
// (packages/levels/bodies/*.json); FA is one engine configured per body, never a
// script per level (docs/04). The performance profile here is the same data FA
// advertises in MA_FlightCapabilityMT and validates against — the pedagogical contract.

/** HSA/CSA performance envelope. Mirrors MA_FlightControlModesPerformanceProfileType. */
export interface CapabilityProfile {
  readonly minAltitude?: number;
  readonly maxAltitude?: number;
  readonly minAirspeed?: number;
  readonly maxAirspeed?: number;
}

export interface BodyCapability {
  readonly id: string; // CapabilityID (short id — fidelity lie #4)
  readonly type: "HSA_CSA";
  readonly profile: CapabilityProfile;
}

/** Point-mass limits (fidelity lie #6: 2D world + altitude scalar). Per tick (1 tick = 1 s). */
export interface FlightModel {
  readonly maxTurnRateDeg: number;
  readonly maxClimbRate: number;
  readonly maxAccel: number;
}

export interface ControlBehavior {
  /** Ticks FA holds a control request in PENDING before APPROVED. 0 = instant (AX-01). */
  readonly approvalLatencyTicks: number;
}

/** Collision-avoidance sensitivity. Present only on "flinchy" airframes: FA takes the
 *  aircraft (CAUTION fault + fly-away) when the commanded vector would enter a threat
 *  zone within this many ticks. Absent ⇒ FA never intervenes (the original bodies). */

export interface PublishSchedule {
  readonly positionIntervalTicks: number;
  readonly activityIntervalTicks: number;
  /** Endurance (NavigationReportMT) publication interval. Absent/0 = never published. */
  readonly navigationIntervalTicks?: number;
}

/**
 * Fuel/endurance model (kg). Present only on fuel-bearing airframes; absent ⇒ no
 * burn, no endurance reports, no fuel-out (the original bodies are unaffected).
 *
 * Fuel flow is a U-shaped curve of airspeed (see the generic aircraft fuel-flow
 * chart): a floor of `minBurn` at the most efficient speed `bestSpeed` (which sits a
 * bit above MinAirspeed), rising quadratically away from it — gently as you slow
 * toward the stall, steeply as you speed up. Per tick (1 tick = 1 s):
 *   burn = minBurn + burnQuad * (speed - bestSpeed)^2
 * Deterministic and learnable, not real aerodynamics (fidelity lie #17).
 */
export interface FuelModel {
  readonly capacity: number;
  /** Fuel flow (kg/tick) at the most efficient speed. */
  readonly minBurn: number;
  /** Speed (m/tick) of minimum fuel flow — set a bit above MinAirspeed. */
  readonly bestSpeed: number;
  /** Curvature: extra kg/tick per (speed - bestSpeed)^2. */
  readonly burnQuad: number;
  /** FA rejects a flight command whose commanded speed leaves fewer than this many
   *  ticks of endurance at the current fuel (VIOLATION_ENDURANCE). Absent = no check. */
  readonly minEnduranceTicks?: number;
}

/** Fuel flow (kg/tick) at a given airspeed for a fuel model: the U-shaped curve. */
export function fuelBurnAt(fuel: FuelModel, speed: number): number {
  const over = speed - fuel.bestSpeed;
  return fuel.minBurn + fuel.burnQuad * over * over;
}

export interface VehicleStart {
  readonly x: number;
  readonly y: number;
  readonly altitude: number;
  readonly heading: number;
  readonly speed: number;
  /** Optional starting fuel (kg); defaults to the body fuel model's capacity. */
  readonly fuel?: number;
}

export interface BodyProfile {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly BodyCapability[];
  readonly flight: FlightModel;
  readonly control: ControlBehavior;
  readonly publish: PublishSchedule;
  readonly start: VehicleStart;
  /** Fuel/endurance model; present only on fuel-bearing airframes. */
  readonly fuel?: FuelModel;
  /** Lookahead (ticks) for FA's collision-avoidance interrupt; absent ⇒ no interrupt. */
  readonly collisionLookaheadTicks?: number;
}

export function findCapability(
  body: BodyProfile,
  capabilityId: string,
): BodyCapability | undefined {
  return body.capabilities.find((c) => c.id === capabilityId);
}

// --- Mission Systems (MS) body --------------------------------------------------
// A sibling of BodyProfile: the MS interface owns the payload (sensors/weapons/
// status), so it is configured separately and a level may reference both an FA body
// (`body`) and an MS body (`msBody`). Kept minimal for the Status Service foundation;
// sensor/weapon/store fields are added by later MS levels (see PLAN_MS.md).

/** One MS subsystem (SubsystemID) with a deterministic state timeline — no RNG.
 *  The latest entry whose `atTick <= tick` wins (the OPERATE warm-up, analogous to
 *  FA's `capability-available`). */
export interface MsSubsystemDef {
  readonly id: string; // SubsystemID
  readonly kind?: string; // author note (e.g. "AESA radar")
  readonly states: readonly { readonly atTick: number; readonly state: string }[];
}

/** One MS service (ServiceID) with a fixed health state for the level. */
export interface MsServiceDef {
  readonly id: string; // ServiceID
  readonly state: string; // ServiceStateEnum literal
}

export interface MsBodyDef {
  readonly id: string;
  readonly name: string;
  readonly subsystems: readonly MsSubsystemDef[];
  readonly services: readonly MsServiceDef[];
  /** MS heartbeat schedule: re-emit every subsystem/service status this often. */
  readonly publish: { readonly statusIntervalTicks: number };
}

/** The subsystem state in effect at `tick`: the latest timeline entry that has fired. */
export function subsystemStateAt(sub: MsSubsystemDef, tick: number): string {
  let state = sub.states[0]?.state ?? "UNKNOWN";
  for (const s of sub.states) {
    if (s.atTick <= tick) state = s.state;
  }
  return state;
}
