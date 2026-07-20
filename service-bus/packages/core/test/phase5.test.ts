/**
 * Phase 5 — CAP. The COP fan-out level: the leader must keep three followers' pictures
 * fresh over P2P links crowded by bulk MD sensor observations. Under passive play a
 * follower starves and the shared picture breaches; shedding the bulk protects the
 * fan-out — at the cost of local track completeness, which is the WP5.2 half.
 *
 * Links are loss-free, so outcomes are deterministic and seed-independent.
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import type { Action, GameState } from "../src/types.ts";
import { run } from "./helpers.ts";

const p5 = { scenarioId: "phase5" };

function play(actions: Record<number, Action[]>, seed = 1): GameState {
  return run({ seed, scenario: p5, actions, maxTicks: 30 });
}

describe("Phase 5 — CAP", () => {
  it("bulk traffic starves a follower — the shared picture breaches (loss)", () => {
    const s = play({});
    expect(s.outcome).toBe("loss");
    expect(s.copBreached).toBe(true);
  });

  it("shedding the bulk keeps every follower fresh (win)", () => {
    const s = play({ 1: [{ type: "shedTraffic" }] });
    expect(s.outcome).toBe("win");
    expect(s.sheddingBulk).toBe(true);
    for (const v of Object.values(s.copFollowers ?? {})) expect(v).toBeGreaterThanOrEqual(25);
  });

  it("raises both teaching beats before the terminal tick", () => {
    let s = createInitialState(1, p5);
    const seen = new Set<string>();
    for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat) {
        seen.add(s.pendingBeat.id);
        s = apply(s, { type: "acknowledgeBeat" });
      }
    }
    expect(seen.has("cop-fanout")).toBe(true);
    expect(seen.has("cop-starvation")).toBe(true);
  });

  // --- WP5.2: shedding is triage, not a free win -------------------------------

  it("makes the starvation prompt actionable — acting on the beat wins", () => {
    // The regression this pins: before WP5.2 the beat fired one decay step from breach,
    // so a player who did exactly what it said still lost, and the level was only
    // winnable by shedding BEFORE the game told you to. A teaching beat that cannot be
    // acted on is worse than no beat.
    let s = createInitialState(1, p5);
    let shedAt: number | null = null;
    for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "cop-starvation" && shedAt === null) {
        shedAt = s.tick;
        s = apply(s, { type: "shedTraffic" });
      }
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    expect(shedAt, "cop-starvation never raised").not.toBeNull();
    expect(s.outcome).toBe("win");
  });

  it("charges for the shed — track completeness decays while bulk is off", () => {
    const s = play({ 1: [{ type: "shedTraffic" }] });
    expect(s.outcome).toBe("win"); // still the right call
    expect(s.trackCompleteness).toBeLessThan(100); // but not a free one
  });

  it("never lets track completeness lose the level on its own", () => {
    // The asymmetry is deliberate: a stale follower loses, degraded fusion does not.
    // Shedding must stay the correct answer.
    const s = play({ 1: [{ type: "shedTraffic" }] });
    expect(s.trackCompleteness).toBeLessThan(100);
    expect(s.outcome).toBe("win");
    expect(s.copBreached).toBe(false);
  });

  it("rebuilds the picture on resume, and resuming never re-starves the fan-out", () => {
    // Resume restores a SUSTAINABLE rate, not the firehose. If it restored the original
    // rate the prompt would be a trap that re-runs the failure it just taught you about.
    let s = createInitialState(1, p5);
    let resumed = false;
    for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "cop-starvation") s = apply(s, { type: "shedTraffic" });
      if (s.pendingBeat?.id === "bulk-resume") {
        resumed = true;
        s = apply(s, { type: "resumeTraffic" });
      }
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    expect(resumed, "bulk-resume never offered").toBe(true);
    expect(s.outcome).toBe("win");
    expect(s.sheddingBulk).toBe(false);
    // Better off than the player who shed and walked away.
    expect(s.trackCompleteness).toBeGreaterThan(
      play({ 1: [{ type: "shedTraffic" }] }).trackCompleteness ?? 0,
    );
  });

  it("only sheds MD bulk — never the COP syncs it exists to protect", () => {
    let s = createInitialState(1, p5);
    for (let t = 1; t <= 3; t++) s = tick(s);
    const copBefore = Object.values(s.messages).filter(
      (m) => m.type === "MA_SynchronizeGlobalCopToPeer",
    ).length;
    s = apply(s, { type: "shedTraffic" });
    const copAfter = Object.values(s.messages).filter(
      (m) => m.type === "MA_SynchronizeGlobalCopToPeer",
    ).length;
    expect(copAfter).toBe(copBefore);
    for (const l of Object.values(s.links)) {
      for (const id of l.queue) expect(s.messages[id]?.cls).not.toBe("MD");
    }
  });

  it("is deterministic and outcome is contention-driven, not seed-driven", () => {
    for (const seed of [1, 5, 77]) {
      expect(play({}, seed).outcome).toBe("loss");
      expect(play({ 1: [{ type: "shedTraffic" }] }, seed).outcome).toBe("win");
    }
  });
});
