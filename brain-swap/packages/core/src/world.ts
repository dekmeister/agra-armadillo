// The immutable world snapshot and its construction. The sim advances only via
// step(world): World on this state (docs/04). A scenario bundles the static config
// (body + optional brain + optional level) that is carried along unchanged so step
// stays a pure single-argument function.
import { type BusState, emptyBus, enqueueAll } from "./bus.ts";
import type { BodyProfile } from "./body.ts";
import { faBootMessages, type FaState, initFaState } from "./fa/engine.ts";
import type { Brain } from "./brain/schema.ts";
import type { LevelDef } from "./level/types.ts";
import type { MessageLogEntry } from "./types.ts";
import { initVehicle, type VehicleState } from "./vehicle/pointmass.ts";

/** MA-side runtime state (the brain). Minimal for the MVP subset. */
export interface MaState {
  readonly brainState: string | null;
}

export interface Scenario {
  readonly body: BodyProfile;
  readonly brain: Brain | null;
  readonly level: LevelDef | null;
}

export type Outcome = "running" | "won" | "failed";

export interface World {
  readonly scenario: Scenario;
  readonly tick: number;
  readonly bus: BusState;
  readonly log: readonly MessageLogEntry[];
  readonly fa: FaState;
  readonly vehicle: VehicleState;
  readonly ma: MaState;
  readonly outcome: Outcome;
  /** Consecutive ticks the level win-predicate has held (toward objective.holdTicks). */
  readonly holdTicks: number;
  /** Index of the next waypoint to reach (waypoint-sequence objectives; 0 otherwise). */
  readonly waypointIndex: number;
}

export function makeScenario(
  body: BodyProfile,
  opts: { brain?: Brain | null; level?: LevelDef | null } = {},
): Scenario {
  return { body, brain: opts.brain ?? null, level: opts.level ?? null };
}

/** Tick-0 world: FA boot advertisements enqueued (delivered at tick 1), vehicle at start. */
export function initWorld(scenario: Scenario): World {
  const bus = enqueueAll(emptyBus(), faBootMessages(scenario.body), 0);
  return {
    scenario,
    tick: 0,
    bus,
    log: [],
    fa: initFaState(),
    vehicle: initVehicle(scenario.level?.start ?? scenario.body.start),
    ma: { brainState: scenario.brain ? scenario.brain.initial : null },
    outcome: "running",
    holdTicks: 0,
    waypointIndex: 0,
  };
}
