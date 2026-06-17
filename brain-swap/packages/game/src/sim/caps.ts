// The honest cap.* key set. FIDELITY: the brain evaluator only resolves the keys that
// `capContext` in packages/core/src/sim.ts exposes — CapabilityID + the four envelope
// numbers actually present on the profile. The send-form CAP palette and the spec sheet
// bind to exactly these (NOT the mockup's cap.MaxSpeed / cap.MaxTurnRate, which the
// evaluator can't resolve).
import { type BodyProfile, findCapability } from "@brain-swap/core";

export interface CapEntry {
  readonly key: string;
  readonly value: string | number;
}

export function capEntries(body: BodyProfile, capabilityId: string): CapEntry[] {
  const cap = findCapability(body, capabilityId);
  const out: CapEntry[] = [{ key: "CapabilityID", value: capabilityId }];
  const p = cap?.profile;
  if (!p) return out;
  if (p.minAltitude !== undefined) out.push({ key: "MinAltitude", value: p.minAltitude });
  if (p.maxAltitude !== undefined) out.push({ key: "MaxAltitude", value: p.maxAltitude });
  if (p.minAirspeed !== undefined) out.push({ key: "MinAirspeed", value: p.minAirspeed });
  if (p.maxAirspeed !== undefined) out.push({ key: "MaxAirspeed", value: p.maxAirspeed });
  return out;
}
