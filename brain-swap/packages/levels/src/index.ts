// Level data access. JSON files (bodies / worlds / reference brains) loaded and typed
// against the core schemas. Data is authored by hand; these casts are the trust
// boundary — the fidelity CI polices the catalog, and the golden-run test polices
// that this data actually composes into a solvable level.
import { type BodyProfile, type Brain, type LevelDef, makeScenario, type Scenario } from "@brain-swap/core";

import ax01Json from "../bodies/ax-01.json";
import ax02Json from "../bodies/ax-02.json";
import ax03Json from "../bodies/ax-03.json";

import level00Json from "../worlds/world-0/level-0.0.json";
import refBrain00Json from "../worlds/world-0/level-0.0.reference-brain.json";
import level11Json from "../worlds/world-1/level-1.1.json";
import refBrain11Json from "../worlds/world-1/level-1.1.reference-brain.json";
import naiveBrain11Json from "../worlds/world-1/level-1.1.naive-brain.json";
import level12Json from "../worlds/world-1/level-1.2.json";
import refBrain12Json from "../worlds/world-1/level-1.2.reference-brain.json";
import level13Json from "../worlds/world-1/level-1.3.json";
import refBrain13Json from "../worlds/world-1/level-1.3.reference-brain.json";
import naiveBrain13Json from "../worlds/world-1/level-1.3.naive-brain.json";
import level14Json from "../worlds/world-1/level-1.4.json";
import refBrain14Json from "../worlds/world-1/level-1.4.reference-brain.json";
import level16Json from "../worlds/world-1/level-1.6.json";
import refBrain16Json from "../worlds/world-1/level-1.6.reference-brain.json";
import naiveBrain16Json from "../worlds/world-1/level-1.6.naive-brain.json";
import level22Json from "../worlds/world-2/level-2.2.json";
import refBrain22Json from "../worlds/world-2/level-2.2.reference-brain.json";
import naiveBrain22Json from "../worlds/world-2/level-2.2.naive-brain.json";
import level42Json from "../worlds/world-4/level-4.2.json";
import refBrain42Json from "../worlds/world-4/level-4.2.reference-brain.json";
import naiveBrain42Json from "../worlds/world-4/level-4.2.naive-brain.json";
import level43Json from "../worlds/world-4/level-4.3.json";
import refBrain43Json from "../worlds/world-4/level-4.3.reference-brain.json";
import naiveBrain43Json from "../worlds/world-4/level-4.3.naive-brain.json";
import level45Json from "../worlds/world-4/level-4.5.json";
import lockedBrain45Json from "../worlds/world-4/level-4.5.locked-brain.json";

// --- Airframes --------------------------------------------------------------
export const ax01 = ax01Json as unknown as BodyProfile;
export const ax02 = ax02Json as unknown as BodyProfile;
export const ax03 = ax03Json as unknown as BodyProfile;

// --- Levels + brains --------------------------------------------------------
export const level00 = level00Json as unknown as LevelDef;
export const level00ReferenceBrain = refBrain00Json as unknown as Brain;

export const level11 = level11Json as unknown as LevelDef;
export const level11ReferenceBrain = refBrain11Json as unknown as Brain;
export const level11NaiveBrain = naiveBrain11Json as unknown as Brain;

export const level12 = level12Json as unknown as LevelDef;
export const level12ReferenceBrain = refBrain12Json as unknown as Brain;

export const level13 = level13Json as unknown as LevelDef;
export const level13ReferenceBrain = refBrain13Json as unknown as Brain;
export const level13NaiveBrain = naiveBrain13Json as unknown as Brain;

export const level14 = level14Json as unknown as LevelDef;
export const level14ReferenceBrain = refBrain14Json as unknown as Brain;

export const level16 = level16Json as unknown as LevelDef;
export const level16ReferenceBrain = refBrain16Json as unknown as Brain;
export const level16NaiveBrain = naiveBrain16Json as unknown as Brain;

export const level22 = level22Json as unknown as LevelDef;
export const level22ReferenceBrain = refBrain22Json as unknown as Brain;
export const level22NaiveBrain = naiveBrain22Json as unknown as Brain;

export const level42 = level42Json as unknown as LevelDef;
export const level42ReferenceBrain = refBrain42Json as unknown as Brain;
export const level42NaiveBrain = naiveBrain42Json as unknown as Brain;

export const level43 = level43Json as unknown as LevelDef;
export const level43ReferenceBrain = refBrain43Json as unknown as Brain;
export const level43NaiveBrain = naiveBrain43Json as unknown as Brain;

export const level45 = level45Json as unknown as LevelDef;
export const level45LockedBrain = lockedBrain45Json as unknown as Brain;

const BODIES: Record<string, BodyProfile> = { "ax-01": ax01, "ax-02": ax02, "ax-03": ax03 };

export function bodyById(id: string): BodyProfile {
  const body = BODIES[id];
  if (!body) throw new Error(`unknown body: ${id}`);
  return body;
}

/** Build a runnable scenario from a level + optional brain (defaults to the reference brain). */
export function scenarioFor(level: LevelDef, brain: Brain | null): Scenario {
  return makeScenario(bodyById(level.body), { brain, level });
}

/** A playable level + the brain its "Load Reference" affordance should load. */
export interface LevelBundle {
  readonly level: LevelDef;
  readonly referenceBrain: Brain;
}

/**
 * Registry of levels playable in the game, keyed by level id. The game resolves
 * the level's body via `bodyById(level.body)`. Multi-body levels (4.5) run on
 * their primary `body` in the single-body game; the locked brain is the reference.
 */
export const LEVELS: Record<string, LevelBundle> = {
  "0.0": { level: level00, referenceBrain: level00ReferenceBrain },
  "1.1": { level: level11, referenceBrain: level11ReferenceBrain },
  "1.2": { level: level12, referenceBrain: level12ReferenceBrain },
  "1.3": { level: level13, referenceBrain: level13ReferenceBrain },
  "1.4": { level: level14, referenceBrain: level14ReferenceBrain },
  "1.6": { level: level16, referenceBrain: level16ReferenceBrain },
  "2.2": { level: level22, referenceBrain: level22ReferenceBrain },
  "4.2": { level: level42, referenceBrain: level42ReferenceBrain },
  "4.3": { level: level43, referenceBrain: level43ReferenceBrain },
  "4.5": { level: level45, referenceBrain: level45LockedBrain },
};

export function levelById(id: string): LevelBundle | undefined {
  return LEVELS[id];
}

/**
 * Build one scenario per body in a multi-body level's `bodies` list (4.5 Type
 * Certificate), each running the same (locked) brain. The level's own `body`
 * field is ignored when `bodies` is present.
 */
export function multiBodyScenarios(level: LevelDef, brain: Brain | null): Scenario[] {
  const ids = level.bodies ?? [level.body];
  return ids.map((id) => makeScenario(bodyById(id), { brain, level }));
}
