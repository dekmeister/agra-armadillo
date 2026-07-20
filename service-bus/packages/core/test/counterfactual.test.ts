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
  levelsWithTaughtPath,
  taughtPathOutcome,
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

/**
 * Per-level counterfactuals (WP6.2).
 *
 * The debrief states "on this seed, <these moves> wins at T+n" after a loss. Phase 6's
 * version of that line used to be a hardcoded string printed on every loss without ever
 * checking whether rerouting would in fact have saved that run — a confident-sounding claim
 * the sim had never been asked to confirm. Replaying the taught path is what makes it earned,
 * so the guard here is that the replay really does win.
 */
describe("taughtPathOutcome", () => {
  it("wins on its own tutorial seed for every level that has a taught path", () => {
    const levels = levelsWithTaughtPath();
    expect(levels.length).toBeGreaterThan(0);
    for (const id of levels) {
      const out = taughtPathOutcome(id, getScenario(id).tutorialSeed);
      expect(out, id).not.toBeNull();
      // If this ever fails, the debrief must render nothing rather than lie — but it also
      // means the level's taught path no longer teaches what its Help text claims.
      expect(out?.won, `${id} taught path must win on its tutorial seed`).toBe(true);
      expect(out?.moves.length, `${id} taught path must actually do something`).toBeGreaterThan(0);
    }
  });

  it("returns null for the levels with no taught path, rather than inventing one", () => {
    // Phases 1 and 8 are near-unloseable bookends; a counterfactual for a level you cannot
    // lose would be a fabricated lesson.
    expect(taughtPathOutcome("phase1", 1)).toBeNull();
    expect(taughtPathOutcome("phase8", 1)).toBeNull();
  });

  it("is pure — repeated calls on the same seed agree", () => {
    expect(taughtPathOutcome("phase6", getScenario("phase6").tutorialSeed)).toEqual(
      taughtPathOutcome("phase6", getScenario("phase6").tutorialSeed),
    );
  });
});
