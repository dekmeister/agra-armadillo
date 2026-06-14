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
  readonly id: string; // CapabilityID, e.g. "CAP-HSA" (short id — fidelity lie #4)
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
}

export interface VehicleStart {
  readonly x: number;
  readonly y: number;
  readonly altitude: number;
  readonly heading: number;
  readonly speed: number;
}

export interface BodyProfile {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly BodyCapability[];
  readonly flight: FlightModel;
  readonly control: ControlBehavior;
  readonly publish: PublishSchedule;
  readonly start: VehicleStart;
}

export function findCapability(body: BodyProfile, capabilityId: string): BodyCapability | undefined {
  return body.capabilities.find((c) => c.id === capabilityId);
}
