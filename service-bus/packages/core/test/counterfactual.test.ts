/**
 * Counterfactual guards (WP5.4).
 *
 * The debrief tells the player what the method they did NOT pick would have cost. That
 * claim is only worth making if it is exactly what would have happened — a plausible
 * number would be worse than no number, because the whole point of the line is that the
 * seed is clamped and the sim is deterministic.
 *
 * So the assertion here is not "the counterfactual returns something sensible" but
 * "the counterfactual equals an actual run of that branch".
 */
import { describe, expect, it } from "vitest";
import {
  apply,
  createInitialState,
  electionCounterfactual,
  electionOutcome,
  tick,
} from "../src/index.ts";
import { getScenario } from "../src/scenario.ts";
import type { ElectionMethod, GameState } from "../src/types.ts";

/** Play L3 picking `method` at the decision beat — the thing the player actually does. */
function playElection(method: ElectionMethod, seed: number): GameState {
  let s = createInitialState(seed, { scenarioId: "phase3" });
  let picked = false;
  for (let t = 1; t <= 40 && s.outcome === "pending"; t++) {
    s = tick(s);
    if (!picked && s.pendingBeat?.id === "election-cost") {
      picked = true;
      s = apply(s, { type: "pickElection", method });
    }
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

const SEED = getScenario("phase3").tutorialSeed;

describe("election counterfactual", () => {
  for (const method of ["static", "raft"] as const) {
    it(`matches a real run of ${method}`, () => {
      const actual = playElection(method, SEED);
      const predicted = electionOutcome("phase3", SEED, method);
      expect(predicted.messages).toBe(actual.election?.msgCount);
      expect(predicted.leader).toBe(actual.election?.leader ?? null);
      expect(predicted.stalled).toBe(!actual.election?.leader);
    });
  }

  it("reports the OTHER method than the one taken", () => {
    expect(electionCounterfactual("phase3", SEED, "static")?.method).toBe("raft");
    expect(electionCounterfactual("phase3", SEED, "raft")?.method).toBe("static");
  });

  it("shows Static as the cheaper method and Raft as the dearer one", () => {
    // The trade the level exists to teach. If a retune ever inverts this, the debrief
    // would be quietly contradicting the beat text that calls Raft "~2n".
    const stat = electionOutcome("phase3", SEED, "static");
    const raft = electionOutcome("phase3", SEED, "raft");
    expect(stat.messages).toBeGreaterThan(0);
    expect(raft.messages).toBeGreaterThan(stat.messages);
  });

  it("is pure — repeated calls on the same seed agree", () => {
    for (const method of ["static", "raft"] as const) {
      expect(electionOutcome("phase3", SEED, method)).toEqual(
        electionOutcome("phase3", SEED, method),
      );
    }
  });
});
