// Level data access. JSON files (bodies / worlds / reference brains) loaded and typed
// against the core schemas. Data is authored by hand; these casts are the trust
// boundary — the fidelity CI polices the catalog, and the golden-run test polices
// that this data actually composes into a solvable level.
import { type BodyProfile, type Brain, type LevelDef, makeScenario, type Scenario } from "@brain-swap/core";

import ax01Json from "../bodies/ax-01.json";
import level12Json from "../worlds/world-1/level-1.2.json";
import refBrain12Json from "../worlds/world-1/level-1.2.reference-brain.json";

export const ax01 = ax01Json as unknown as BodyProfile;
export const level12 = level12Json as unknown as LevelDef;
export const level12ReferenceBrain = refBrain12Json as unknown as Brain;

const BODIES: Record<string, BodyProfile> = { "ax-01": ax01 };

export function bodyById(id: string): BodyProfile {
  const body = BODIES[id];
  if (!body) throw new Error(`unknown body: ${id}`);
  return body;
}

/** Build a runnable scenario from a level + optional brain (defaults to the reference brain). */
export function scenarioFor(level: LevelDef, brain: Brain | null): Scenario {
  return makeScenario(bodyById(level.body), { brain, level });
}
