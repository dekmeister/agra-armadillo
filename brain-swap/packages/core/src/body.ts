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
}

export function findCapability(body: BodyProfile, capabilityId: string): BodyCapability | undefined {
  return body.capabilities.find((c) => c.id === capabilityId);
}
