/**
 * Phase 3 — Team Formation. Message-driven leader election over a P2P mesh.
 *  - Static Fitness declares locally (cheap, no quorum) → always converges.
 *  - Raft gathers a majority of votes (~2n) → converges with quorum, STALLS without.
 *  - Static's message cost is lower than Raft's.
 *
 * The nominal mesh is loss-free (deterministic convergence); a scripted partition
 * (contingencyTick overridden early) severs it to force the Raft quorum stall.
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import type { ScenarioOpts } from "../src/scenario.ts";
import type { ElectionMethod, GameState, ScenarioConfig } from "../src/types.ts";
import { run } from "./helpers.ts";

const p3 = (config?: Partial<ScenarioConfig>): ScenarioOpts => ({ scenarioId: "phase3", config });

/**
 * Pick a method at tick 1 and dismiss any decision beat as it appears (as the UI does
 * when the player acts on the decision card). Runs to conclusion.
 */
function elect(method: ElectionMethod, config?: Partial<ScenarioConfig>, seed = 1): GameState {
  let s = createInitialState(seed, p3(config));
  let picked = false;
  for (let t = 1; t <= 25 && s.outcome === "pending"; t++) {
    s = tick(s);
    if (!picked) {
      s = apply(s, { type: "pickElection", method });
      picked = true;
    }
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

describe("Phase 3 — Team Formation", () => {
  it("Static Fitness elects the fittest node cheaply", () => {
    const s = elect("static");
    expect(s.outcome).toBe("win");
    expect(s.election?.leader).toBe("acp2"); // pre-loaded fittest
    expect(s.nodes.acp2?.isLeader).toBe(true);
  });

  it("Raft converges with a quorum available", () => {
    const s = elect("raft");
    expect(s.outcome).toBe("win");
    expect(s.election?.leader).toBe("acp2");
    expect(s.election?.votes.length).toBeGreaterThanOrEqual(s.election?.quorum ?? 99);
  });

  it("Static costs fewer messages than Raft (~n vs ~2n)", () => {
    const staticMsgs = elect("static").election?.msgCount ?? 0;
    const raftMsgs = elect("raft").election?.msgCount ?? 0;
    expect(staticMsgs).toBeGreaterThan(0);
    expect(staticMsgs).toBeLessThan(raftMsgs);
  });

  it("Raft STALLS on a partitioned mesh (no quorum) and loses", () => {
    const s = elect("raft", { contingencyTick: 1 });
    expect(s.outcome).toBe("loss");
    expect(s.election?.leader).toBeNull();
    expect(s.seenBeats).toContain("quorum");
  });

  it("Static still elects on the same partition (no quorum needed)", () => {
    const s = elect("static", { contingencyTick: 1 });
    expect(s.outcome).toBe("win");
    expect(s.election?.leader).toBe("acp2");
  });

  it("doing nothing (no election) loses — a leader must be chosen", () => {
    const s = run({ seed: 1, scenario: p3(), actions: {}, maxTicks: 25 });
    expect(s.outcome).toBe("loss");
  });

  it("raises the election-cost beat before any terminal tick", () => {
    let s = createInitialState(1, p3());
    s = tick(s);
    expect(s.pendingBeat?.id).toBe("election-cost");
    expect(s.outcome).toBe("pending");
  });

  it("is deterministic per seed", () => {
    for (const seed of [1, 3, 50]) {
      const a = elect("raft", undefined, seed);
      const b = elect("raft", undefined, seed);
      expect(a.outcome).toBe(b.outcome);
      expect(a.election?.msgCount).toBe(b.election?.msgCount);
    }
  });
});
