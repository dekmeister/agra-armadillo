// Level definition shape (packages/levels/worlds/*/level-*.json). Win conditions are
// world-state based, never "message sent" (docs/01) — the brain must consume vehicle
// state to know it has arrived. A level references a body by id and the controlled
// capability; the deterministic event schedule lives here too (none needed for 1.2).
import type { VehicleStart } from "../body.ts";
import type { MessageTypeName } from "../messages/index.ts";
import type { MissionEvent } from "./events.ts";

export interface Zone {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** A no-fly / threat circle. Entering one fails the run; orthogonal to the
 *  objective kind (a level may pair `avoid` with any objective). */
export interface AvoidZone extends Zone {
  readonly id: string;
}

/** One leg of a waypoint sequence: a zone plus an optional altitude band. */
export interface Waypoint {
  readonly zone: Zone;
  /** Optional commanded altitude (m) and band. Omit to accept any altitude. */
  readonly altitude?: number;
  readonly altitudeTolerance?: number;
}

/**
 * Win conditions are a discriminated union on `kind`. Every variant carries
 * `holdTicks` (consecutive ticks the terminal predicate must hold), so callers
 * can read `objective.holdTicks` without narrowing. New worlds add new kinds
 * here rather than special-casing the runtime.
 */

/** Reach a zone at a target altitude and hold (level 1.2, 1.3, 4.5). */
export interface ReachHoldObjective {
  readonly kind: "reach-hold";
  /** Reach-and-hold zone. */
  readonly zone: Zone;
  /** Commanded altitude to hold (m) and tolerance band. */
  readonly altitude: number;
  readonly altitudeTolerance: number;
  /** Consecutive ticks the win predicate must hold (10 for 1.2). */
  readonly holdTicks: number;
}

/** Acquire and retain secondary control for a span of ticks; no flight (level 1.1). */
export interface HoldControlObjective {
  readonly kind: "hold-control";
  /** Consecutive ticks MA must be the secondary controller of `capabilityId`. */
  readonly holdTicks: number;
}

/** Pass through an ordered list of waypoints; hold the final one (level 1.4). */
export interface WaypointSequenceObjective {
  readonly kind: "waypoint-sequence";
  readonly waypoints: readonly Waypoint[];
  /** Consecutive ticks the final waypoint predicate must hold. */
  readonly holdTicks: number;
}

export type Objective = ReachHoldObjective | HoldControlObjective | WaypointSequenceObjective;

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
  /** One-line mission framing surfaced in-game (optional teaching copy). */
  readonly brief?: string;
  /** The lesson this level teaches (optional teaching copy). */
  readonly teaches?: string;
  /** For multi-body levels (e.g. 4.5 Type Certificate): bodies the one brain must satisfy. */
  readonly bodies?: readonly string[];
  /**
   * Optional per-mission vehicle start, overriding the body's default. Decouples
   * mission geometry from the airframe so one body can fly different setups
   * (e.g. 1.3 starts near the ceiling).
   */
  readonly start?: VehicleStart;
  /** Subset of the catalog available in this level's editor (UI concern; informational here). */
  readonly availableMessages?: readonly MessageTypeName[];
  /** Hard tick budget; the sim fails the run if exceeded (keeps golden runs finite). */
  readonly maxTicks: number;
  /** No-fly circles; entering any one fails the run. Composes with any objective and
   *  with event-spawned `World.threats` (both are breach-checked the same way). */
  readonly avoid?: readonly AvoidZone[];
  /** Deterministic scheduled mid-mission changes (envelope degrade, capability pull,
   *  threat spawn). Each fires in the step advancing the world to its `tick`. */
  readonly events?: readonly MissionEvent[];
  readonly pars?: LevelPars;
  /** Fidelity-note references surfaced in-game (docs/02 list indices). */
  readonly fidelityNotes?: readonly number[];
}
