/**
 * Phase 5 — CAP. The COP fan-out level: the leader must keep three followers' pictures
 * fresh over P2P links crowded by bulk MD/MP. Under passive play a follower starves and
 * the shared picture breaches; shedding the bulk protects the fan-out.
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

  it("is deterministic and outcome is contention-driven, not seed-driven", () => {
    for (const seed of [1, 5, 77]) {
      expect(play({}, seed).outcome).toBe("loss");
      expect(play({ 1: [{ type: "shedTraffic" }] }, seed).outcome).toBe("win");
    }
  });
});
