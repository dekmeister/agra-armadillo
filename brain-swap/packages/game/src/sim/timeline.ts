// Sim ↔ UI bridge. docs/04: "the sim advances only via step(world): World on immutable
// state; the React app drives it from a rAF loop and renders snapshots. Rewind =
// re-simulate from tick 0 to N." We materialize the whole deterministic run once into a
// World[] (index === tick); play/pause/step/scrub are then pure index moves into it.
// All nondeterminism (rAF, clock) lives in the React layer, never here or in core.
import { initWorld, type Scenario, step, type World } from "@brain-swap/core";

/** A bounded ceiling so a pathological (never-terminating, no-level) scenario can't spin. */
const HARD_CEILING = 1000;

/**
 * Build the full timeline for a scenario: `timeline[0] = initWorld`, then `step` until the
 * world terminates (won/failed) or the level's maxTicks (or the hard ceiling) is reached.
 * Deterministic: the same scenario always yields the same array.
 */
export function buildTimeline(scenario: Scenario): World[] {
  const cap = scenario.level?.maxTicks ?? HARD_CEILING;
  const frames: World[] = [initWorld(scenario)];
  let w = frames[0]!;
  while (w.outcome === "running" && w.tick < cap) {
    w = step(w);
    frames.push(w);
  }
  return frames;
}

/** The final world of a timeline (terminal or budget-capped). */
export function finalFrame(timeline: World[]): World {
  return timeline[timeline.length - 1]!;
}
