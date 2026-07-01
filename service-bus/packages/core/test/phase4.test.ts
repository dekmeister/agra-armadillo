/**
 * Phase 4 — Transit. The queue-discipline level: a formation heartbeat competes with
 * routine C2 on one bandwidth-capped, loss-free link. Under FIFO the heartbeat starves
 * and the formation lapses; Class/EDF float it to the front and it survives.
 *
 * The link is loss-free, so outcomes are deterministic and seed-independent — the
 * lesson is purely bandwidth, not luck.
 */
import { describe, expect, it } from "vitest";
import { createInitialState, tick } from "../src/index.ts";
import type { Action, GameState } from "../src/types.ts";
import { run } from "./helpers.ts";

const p4 = { scenarioId: "phase4" };

/** Play the level applying an optional one-off policy change at tick 1. */
function playWithPolicy(policy?: "class" | "edf", seed = 1): GameState {
  const actions: Record<number, Action[]> = policy
    ? { 1: [{ type: "setPolicy", linkId: "form", policy }] }
    : {};
  return run({ seed, scenario: p4, actions, maxTicks: 30 });
}

describe("Phase 4 — Transit", () => {
  it("FIFO starves the heartbeat — the formation lapses (loss)", () => {
    const s = playWithPolicy();
    expect(s.outcome).toBe("loss");
    expect(s.copBreached).toBe(true);
  });

  it("Class (priority) floats the heartbeat up and holds the formation (win)", () => {
    const s = playWithPolicy("class");
    expect(s.outcome).toBe("win");
    expect(s.copBreached).toBe(false);
  });

  it("EDF (deadline) also rescues the heartbeat (win)", () => {
    const s = playWithPolicy("edf");
    expect(s.outcome).toBe("win");
  });

  it("raises both teaching beats before the terminal tick", () => {
    let s = createInitialState(1, p4);
    const seen = new Set<string>();
    for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat) {
        seen.add(s.pendingBeat.id);
        s = { ...s, pendingBeat: null }; // dismiss without changing policy (passive)
      }
    }
    expect(seen.has("bandwidth-cap")).toBe(true);
    expect(seen.has("queue-discipline")).toBe(true);
  });

  it("is deterministic (loss-free link → identical run per seed)", () => {
    for (const seed of [1, 7, 42]) {
      const a = playWithPolicy(undefined, seed);
      const b = playWithPolicy(undefined, seed);
      expect(a.outcome).toBe(b.outcome);
      expect(a.tick).toBe(b.tick);
      expect(a.cop).toBe(b.cop);
    }
  });

  it("outcome is bandwidth-driven, not seed-driven (same result across seeds)", () => {
    for (const seed of [1, 2, 3, 99]) {
      expect(playWithPolicy(undefined, seed).outcome).toBe("loss");
      expect(playWithPolicy("class", seed).outcome).toBe("win");
    }
  });
});
