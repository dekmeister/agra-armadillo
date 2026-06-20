// FA flight-command validator. FA validates against exactly the envelope it
// advertised in MA_FlightCapabilityMT (docs/04 pedagogical contract). Rejection
// reasons are the real MA_ValidationResultEnum literals (docs/02). Deterministic
// and learnable (fidelity lie #9).
import { type BodyProfile, type CapabilityProfile, findCapability, fuelBurnAt } from "../body.ts";
import type { MA_FlightCommandMT, MA_FlightCommandStatusMT } from "../messages/index.ts";
import type { FlightTarget, VehicleState } from "../vehicle/pointmass.ts";

export type ValidationResult = NonNullable<MA_FlightCommandStatusMT["ValidationResult"]>;

export interface ValidationOutcome {
  readonly accepted: boolean;
  readonly result: ValidationResult;
  /** Vehicle target to apply when accepted (undefined for a rejected command). */
  readonly target?: FlightTarget;
}

function reject(result: ValidationResult): ValidationOutcome {
  return { accepted: false, result };
}

/**
 * Validate an HSA flight command against the body's advertised capability envelope.
 * Order matches docs/05 step 3: capability known? then envelope. No controller check
 * here — that is FA's listening gate (engine), not command validation.
 *
 * `profileOverride` is the current effective envelope when a `degrade-envelope`
 * mission event has tightened it (sim.ts threads `world.dynamicEnvelope[capId]`);
 * absent ⇒ validate against the body's static profile, exactly as before.
 *
 * `vehicle` supplies current fuel for the endurance pre-check (fuel-bearing bodies
 * with `fuel.minEnduranceTicks`): FA rejects a command whose commanded speed would
 * leave too little remaining endurance — VIOLATION_ENDURANCE (the Bingo lesson).
 */
export function validateFlightCommand(
  body: BodyProfile,
  cmd: MA_FlightCommandMT,
  profileOverride?: CapabilityProfile,
  vehicle?: VehicleState,
): ValidationOutcome {
  const cap = findCapability(body, cmd.CapabilityID);
  if (!cap) return reject("CAPABILITY_NOT_SUPPORTED");
  // A route-following (WAYPOINT_FOLLOWING) capability doesn't advertise direct HSA/CSA
  // vectoring, so FA rejects a hand-flown MA_FlightCommandMT against it — the route-only
  // levels are flown by uploading a plan, not by direct commands (VI MA_FlightCapabilityEnum).
  if (cap.type !== "HSA_CSA") return reject("CAPABILITY_NOT_SUPPORTED");

  // CANCEL clears the active vector; always valid for a known capability.
  if (cmd.CommandState === "CANCEL") {
    return { accepted: true, result: "FLIGHT_COMMAND_VALID", target: {} };
  }

  const p = profileOverride ?? cap.profile;
  if (cmd.Altitude !== undefined) {
    if (p.maxAltitude !== undefined && cmd.Altitude > p.maxAltitude) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
    if (p.minAltitude !== undefined && cmd.Altitude < p.minAltitude) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
  }
  if (cmd.Speed !== undefined) {
    if (p.maxAirspeed !== undefined && cmd.Speed > p.maxAirspeed) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
    if (p.minAirspeed !== undefined && cmd.Speed < p.minAirspeed) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
  }

  // Endurance reserve: a faster command burns fuel quicker, leaving less loiter time.
  if (
    cmd.Speed !== undefined &&
    body.fuel?.minEnduranceTicks !== undefined &&
    vehicle?.fuel !== undefined
  ) {
    const burn = fuelBurnAt(body.fuel, cmd.Speed);
    if (burn > 0 && vehicle.fuel / burn < body.fuel.minEnduranceTicks) {
      return reject("VIOLATION_ENDURANCE");
    }
  }

  const target: FlightTarget = {
    ...(cmd.Heading !== undefined ? { heading: cmd.Heading } : {}),
    ...(cmd.Altitude !== undefined ? { altitude: cmd.Altitude } : {}),
    ...(cmd.Speed !== undefined ? { speed: cmd.Speed } : {}),
  };
  return { accepted: true, result: "FLIGHT_COMMAND_VALID", target };
}

/**
 * Validate a curve-following command (MA_FlightCommandMT with a Curvature, level 2.4).
 * The airframe must support the CurveFollowing mode (body.curve) — else
 * CAPABILITY_NOT_SUPPORTED — and the commanded Curvature must sit within the body's
 * limit (radius >= min radius) — else PERFORMANCE_LIMIT_EXCEEDED. Altitude/airspeed are
 * still checked against the envelope, reusing the HSA path's reasons.
 */
export function validateCurveCommand(
  body: BodyProfile,
  cmd: MA_FlightCommandMT,
  profileOverride?: CapabilityProfile,
): ValidationOutcome {
  const cap = findCapability(body, cmd.CapabilityID);
  if (!cap || body.curve === undefined) return reject("CAPABILITY_NOT_SUPPORTED");
  if (cmd.Curvature !== undefined && cmd.Curvature > body.curve.maxCurvature) {
    return reject("PERFORMANCE_LIMIT_EXCEEDED");
  }
  const p = profileOverride ?? cap.profile;
  if (cmd.Altitude !== undefined) {
    if (p.maxAltitude !== undefined && cmd.Altitude > p.maxAltitude) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
    if (p.minAltitude !== undefined && cmd.Altitude < p.minAltitude) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
  }
  if (cmd.Speed !== undefined) {
    if (p.maxAirspeed !== undefined && cmd.Speed > p.maxAirspeed) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
    if (p.minAirspeed !== undefined && cmd.Speed < p.minAirspeed) {
      return reject("PERFORMANCE_LIMIT_EXCEEDED");
    }
  }
  return { accepted: true, result: "FLIGHT_COMMAND_VALID" };
}
