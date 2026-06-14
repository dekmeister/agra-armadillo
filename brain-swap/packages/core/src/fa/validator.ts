// FA flight-command validator. FA validates against exactly the envelope it
// advertised in MA_FlightCapabilityMT (docs/04 pedagogical contract). Rejection
// reasons are the real MA_ValidationResultEnum literals (docs/02). Deterministic
// and learnable (fidelity lie #9).
import { type BodyProfile, findCapability } from "../body.ts";
import type { MA_FlightCommandMT, MA_FlightCommandStatusMT } from "../messages/index.ts";
import type { FlightTarget } from "../vehicle/pointmass.ts";

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
 */
export function validateFlightCommand(body: BodyProfile, cmd: MA_FlightCommandMT): ValidationOutcome {
  const cap = findCapability(body, cmd.CapabilityID);
  if (!cap) return reject("CAPABILITY_NOT_SUPPORTED");

  // CANCEL clears the active vector; always valid for a known capability.
  if (cmd.CommandState === "CANCEL") {
    return { accepted: true, result: "FLIGHT_COMMAND_VALID", target: {} };
  }

  const p = cap.profile;
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

  const target: FlightTarget = {
    ...(cmd.Heading !== undefined ? { heading: cmd.Heading } : {}),
    ...(cmd.Altitude !== undefined ? { altitude: cmd.Altitude } : {}),
    ...(cmd.Speed !== undefined ? { speed: cmd.Speed } : {}),
  };
  return { accepted: true, result: "FLIGHT_COMMAND_VALID", target };
}
