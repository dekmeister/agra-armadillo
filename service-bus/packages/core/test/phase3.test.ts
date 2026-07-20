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

  it("shows the package forming before asking which election method to use", () => {
    // WP5.4/WP6.1: the beat used to fire at T+1, asking the player to weigh the message
    // cost of two methods with an empty board in front of them. It must now wait until
    // peer-join traffic has completed at least one full leg, so the "coordination costs
    // messages" claim is something they have watched rather than been told.
    let s = createInitialState(1, p3());
    s = tick(s);
    expect(s.pendingBeat?.id, "election decision raised before any traffic moved").not.toBe(
      "election-cost",
    );

    let raisedAt: number | null = null;
    let joinsDelivered = 0;
    for (let t = 1; t <= 25 && s.outcome === "pending" && raisedAt === null; t++) {
      joinsDelivered = Object.values(s.messages).filter(
        (m) => m.type === "MA_CommAvailableEndpointsMT" && m.state === "SENT",
      ).length;
      if (s.pendingBeat?.id === "election-cost") raisedAt = s.tick;
      else s = tick(s);
    }
    expect(raisedAt, "election-cost never raised").not.toBeNull();
    expect(joinsDelivered, "no peer joins had landed by the decision").toBeGreaterThan(0);
    expect(s.outcome).toBe("pending");
  });

  it("lets a stalled Raft election be replaced by Static", () => {
    // The `quorum` beat offers pickElection again, but startElection refuses to begin a
    // second election while one is in flight — so before WP5.4 taking the beat's own
    // advice after a Raft stall did nothing at all.
    let s = createInitialState(1, { ...p3(), config: { contingencyTick: 1 } });
    for (let t = 1; t <= 4; t++) {
      s = tick(s);
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    s = apply(s, { type: "pickElection", method: "raft" });
    for (let t = 1; t <= 6; t++) {
      s = tick(s);
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    expect(s.election?.leader, "Raft should be stalled on the severed mesh").toBeFalsy();

    s = apply(s, { type: "pickElection", method: "static" });
    expect(s.election?.method).toBe("static");
    expect(s.election?.leader, "Static declares locally, no quorum needed").toBeTruthy();
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
