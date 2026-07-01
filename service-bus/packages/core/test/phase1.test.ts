/**
 * Phase 1 — Launch. The vocabulary level: a clean C2 round trip + a free on-platform
 * VI loop. Verifies the round trip wins, both teaching beats surface before the win,
 * and the VI loop never fails (on-platform ≠ over-the-air).
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import type { GameState } from "../src/types.ts";
import { run } from "./helpers.ts";

const p1 = { scenarioId: "phase1" };

/** Play through, acknowledging every beat (as the paused view would). */
function playAck(seed: number, maxTicks = 30): GameState {
  let s = createInitialState(seed, p1);
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

describe("Phase 1 — Launch", () => {
  it("completes the takeoff round trip (win) on a clean link", () => {
    const s = run({ seed: 1, scenario: p1, maxTicks: 30 });
    expect(s.outcome).toBe("win");
    expect(s.objective).toBe("complete");
  });

  it("surfaces both teaching beats before the round trip wins", () => {
    const s = playAck(1);
    expect(s.outcome).toBe("win");
    expect(s.seenBeats).toContain("on-platform-free");
    expect(s.seenBeats).toContain("lifecycle");
  });

  it("the VI loop is free and reliable — it never fails over the air", () => {
    let s = createInitialState(7, p1);
    for (let t = 1; t <= 12; t++) s = apply(tick(s), { type: "acknowledgeBeat" });
    const vi = Object.values(s.messages).filter((m) => m.cls === "VI");
    expect(vi.length).toBeGreaterThan(0);
    expect(vi.some((m) => m.state.startsWith("FAIL"))).toBe(false);
  });

  it("is deterministic for a given seed", () => {
    const a = run({ seed: 3, scenario: p1, maxTicks: 30 });
    const b = run({ seed: 3, scenario: p1, maxTicks: 30 });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
