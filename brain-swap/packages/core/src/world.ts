// The immutable world snapshot and its construction. The sim advances only via
// step(world): World on this state (docs/04). A scenario bundles the static config
// (body + optional brain + optional level) that is carried along unchanged so step
// stays a pure single-argument function.

import type { BodyProfile, CapabilityProfile, MsBodyDef } from "./body.ts";
import type { Brain } from "./brain/schema.ts";
import { type BusState, emptyBus, enqueueAll } from "./bus.ts";
import { type FaState, faBootMessages, initFaState } from "./fa/engine.ts";
import type { ActiveThreat } from "./level/events.ts";
import type { LevelDef } from "./level/types.ts";
import { initMsState, msBootMessages, type MsState } from "./ms/engine.ts";
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
  /** Optional Mission Systems body — present when the level orchestrates the MS
   *  interface in parallel with FA. Null for FA-only levels (the original set). */
  readonly msBody: MsBodyDef | null;
}

export type Outcome = "running" | "won" | "failed";

export interface World {
  readonly scenario: Scenario;
  readonly tick: number;
  readonly bus: BusState;
  readonly log: readonly MessageLogEntry[];
  readonly fa: FaState;
  /** MS-side runtime state; null when the scenario has no MS body. */
  readonly ms: MsState | null;
  readonly vehicle: VehicleState;
  readonly ma: MaState;
  readonly outcome: Outcome;
  /** Consecutive ticks the level win-predicate has held (toward objective.holdTicks). */
  readonly holdTicks: number;
  /** Index of the next waypoint to reach (waypoint-sequence objectives; 0 otherwise). */
  readonly waypointIndex: number;
  /** Threat zones currently in the world (populated by `spawn-threat` events). */
  readonly threats: readonly ActiveThreat[];
  /** capabilityId -> effective envelope after `degrade-envelope` events (absent = static). */
  readonly dynamicEnvelope: Readonly<Record<string, CapabilityProfile>>;
}

export function makeScenario(
  body: BodyProfile,
  opts: { brain?: Brain | null; level?: LevelDef | null; msBody?: MsBodyDef | null } = {},
): Scenario {
  return {
    body,
    brain: opts.brain ?? null,
    level: opts.level ?? null,
    msBody: opts.msBody ?? null,
  };
}

/** Tick-0 world: FA boot advertisements enqueued (delivered at tick 1), vehicle at start.
 *  A capability with a scheduled `capability-available` event boots TEMPORARILY_UNAVAILABLE
 *  (FA isn't ready yet; ACQUIRE is REJECTED until the event fires AVAILABLE). */
export function initWorld(scenario: Scenario): World {
  const unavailable: Record<string, "TEMPORARILY_UNAVAILABLE"> = {};
  for (const e of scenario.level?.events ?? []) {
    if (e.kind === "capability-available") unavailable[e.capabilityId] = "TEMPORARILY_UNAVAILABLE";
  }
  // Boot messages: FA advertisements + (if present) the MS heartbeat, all enqueued at
  // tick 0 on the one shared bus, delivered at tick 1.
  const boot = [...faBootMessages(scenario.body, unavailable)];
  const ms = scenario.msBody ? initMsState(scenario.msBody) : null;
  if (scenario.msBody) boot.push(...msBootMessages(scenario.msBody));
  const bus = enqueueAll(emptyBus(), boot, 0);
  const fa =
    Object.keys(unavailable).length > 0
      ? { ...initFaState(), unavailableCaps: unavailable }
      : initFaState();
  return {
    scenario,
    tick: 0,
    bus,
    log: [],
    fa,
    ms,
    vehicle: initVehicle(
      scenario.level?.start ?? scenario.body.start,
      scenario.body.fuel?.capacity,
    ),
    ma: { brainState: scenario.brain ? scenario.brain.initial : null },
    outcome: "running",
    holdTicks: 0,
    waypointIndex: 0,
    threats: [],
    dynamicEnvelope: {},
  };
}
