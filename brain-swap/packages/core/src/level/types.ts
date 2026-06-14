// Level definition shape (packages/levels/worlds/*/level-*.json). Win conditions are
// world-state based, never "message sent" (docs/01) — the brain must consume vehicle
// state to know it has arrived. A level references a body by id and the controlled
// capability; the deterministic event schedule lives here too (none needed for 1.2).
import type { MessageTypeName } from "../messages/index.ts";

export interface Zone {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface Objective {
  /** Reach-and-hold zone. */
  readonly zone: Zone;
  /** Commanded altitude to hold (m) and tolerance band. */
  readonly altitude: number;
  readonly altitudeTolerance: number;
  /** Consecutive ticks the win predicate must hold (10 for 1.2). */
  readonly holdTicks: number;
}

export interface LevelPars {
  readonly ticks: number;
  readonly busTraffic: number;
  readonly rejections: number;
  readonly brainSize: number;
}

export interface LevelDef {
  readonly id: string;
  readonly title: string;
  readonly body: string; // body id reference
  /** Capability the level expects MA to control (drives `cap.*` template refs). */
  readonly capabilityId: string;
  readonly objective: Objective;
  /** Subset of the catalog available in this level's editor (UI concern; informational here). */
  readonly availableMessages?: readonly MessageTypeName[];
  /** Hard tick budget; the sim fails the run if exceeded (keeps golden runs finite). */
  readonly maxTicks: number;
  readonly pars?: LevelPars;
  /** Fidelity-note references surfaced in-game (docs/02 list indices). */
  readonly fidelityNotes?: readonly number[];
}
