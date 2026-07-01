/**
 * Phase 2 — Hold. The failure-vocabulary level: a flapping C2 status link.
 *
 * Engine note: FAIL_UNSENT is an intra-tick transient — a blocked dispatch is set
 * FAIL_UNSENT then reverted to PENDING within the same dispatch pass (it auto-retries
 * next tick), so it is never visible in a post-tick snapshot. FAIL_MISSING_ACK is the
 * terminal, observable failure and the one the player must act on (retry).
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import type { GameState } from "../src/types.ts";

const p2 = { scenarioId: "phase2" };

function hasMissingAck(s: GameState): boolean {
  return Object.values(s.messages).some(
    (m) => m.type === "MA_CommTeamReportMT" && m.state === "FAIL_MISSING_ACK",
  );
}

/** Passive play: acknowledge beats, take no recovery action. */
function playPassive(seed: number, maxTicks = 40): GameState {
  let s = createInitialState(seed, p2);
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

/** Attentive play: retry any unconfirmed (MISSING_ACK) report each tick. */
function playRetry(seed: number, maxTicks = 40): GameState {
  let s = createInitialState(seed, p2);
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    if (hasMissingAck(s)) s = apply(s, { type: "retry" });
  }
  return s;
}

describe("Phase 2 — Hold", () => {
  it("scripts a BAD burst and raises the burst-loss beat at the contingency tick", () => {
    let s = createInitialState(1, p2);
    let raised = false;
    for (let t = 1; t <= 6 && !raised; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "burst-loss") raised = true;
    }
    expect(raised).toBe(true);
  });

  it("exercises the terminal FAIL_MISSING_ACK failure mode and surfaces its beat", () => {
    let sawTerminalMissingAck = false;
    let sawBeat = false;
    for (let seed = 1; seed <= 40 && !(sawTerminalMissingAck && sawBeat); seed++) {
      let s = createInitialState(seed, p2);
      for (let t = 1; t <= 30; t++) {
        s = tick(s);
        if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
        if (hasMissingAck(s)) sawTerminalMissingAck = true;
        if (s.seenBeats.includes("missing-ack-intro")) sawBeat = true;
      }
    }
    expect(sawTerminalMissingAck).toBe(true);
    expect(sawBeat).toBe(true);
  });

  it("always reaches a terminal outcome within the hold window", () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(playPassive(seed).outcome).not.toBe("pending");
    }
  });

  it("actively retrying clears holds that passivity loses (delivery ≠ confirmation)", () => {
    let passiveLosses = 0;
    let rescues = 0;
    for (let seed = 1; seed <= 60; seed++) {
      if (playPassive(seed).outcome === "loss") {
        passiveLosses += 1;
        if (playRetry(seed).outcome === "win") rescues += 1;
      }
    }
    expect(passiveLosses).toBeGreaterThan(0);
    expect(rescues).toBeGreaterThan(0);
  });
});
