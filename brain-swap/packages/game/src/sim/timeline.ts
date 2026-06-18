// Sim ↔ UI bridge. docs/04: "the sim advances only via step(world): World on immutable
// state; the React app drives it from a rAF loop and renders snapshots. Rewind =
// re-simulate from tick 0 to N." We materialize the whole deterministic run once into a
// World[] (index === tick); play/pause/step/scrub are then pure index moves into it.
// All nondeterminism (rAF, clock) lives in the React layer, never here or in core.
import type { World } from "@brain-swap/core";

/** The final world of a timeline (terminal or budget-capped). */
export function finalFrame(timeline: World[]): World {
  return timeline[timeline.length - 1]!;
}
