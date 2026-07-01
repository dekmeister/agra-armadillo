/**
 * Phase 8 — Land. The capstone: a clean LRE-authorised landing round trip that closes
 * the arc opened in L1 and raises the campaign-debrief recap. Unloseable (clean links).
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import type { GameState } from "../src/types.ts";

const p8 = { scenarioId: "phase8" };

function playThrough(seed = 1): GameState {
  let s = createInitialState(seed, p8);
  for (let t = 1; t <= 20 && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

describe("Phase 8 — Land", () => {
  it("the LRE-authorised landing round trip completes (win)", () => {
    const s = playThrough();
    expect(s.outcome).toBe("win");
    expect(s.objective).toBe("complete");
  });

  it("raises the campaign-debrief beat before the win", () => {
    let s = createInitialState(1, p8);
    let sawDebrief = false;
    for (let t = 1; t <= 20 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "campaign-debrief") sawDebrief = true;
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    expect(sawDebrief).toBe(true);
    expect(s.outcome).toBe("win");
  });

  it("is deterministic and wins across seeds", () => {
    for (const seed of [1, 12, 99]) {
      expect(playThrough(seed).outcome).toBe("win");
    }
  });
});
