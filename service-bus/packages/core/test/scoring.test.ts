import { describe, expect, it } from "vitest";
import type { Action } from "../src/types.ts";
import { run } from "./helpers.ts";

const reroute = (t: number): Record<number, Action[]> => ({
  0: [{ type: "arm" }],
  [t]: [{ type: "reroute" }],
});

describe("scoring", () => {
  it("a win adds scoreWin exactly once", () => {
    const s = run({ seed: 5, actions: reroute(3), maxTicks: 30 });
    expect(s.outcome).toBe("win");
    expect(s.score).toBe(s.config.scoreStart + s.config.scoreWin);
  });

  it("a WEZ miss subtracts scoreMiss", () => {
    // Force a loss: arm, do nothing, run past the deadline on a sticky-bad seed.
    let lost = run({ seed: 2, actions: { 0: [{ type: "arm" }] } });
    for (let seed = 2; seed <= 50 && lost.outcome !== "loss"; seed++) {
      lost = run({ seed, actions: { 0: [{ type: "arm" }] } });
    }
    expect(lost.outcome).toBe("loss");
    expect(lost.score).toBe(lost.config.scoreStart - lost.config.scoreMiss);
  });
});
