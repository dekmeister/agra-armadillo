/**
 * Player-move recording (WP6.3).
 *
 * The debrief's "Your moves" list used to be reconstructed by regexing the event log.
 * These tests pin the three ways that failed, so the log-scraping approach can't come back:
 *
 *  1. Phase 6 auto-re-queues a MISSING_ACK reply and logs "…Re-attempting.", which the old
 *     regex matched — so a completely passive losing run listed a move the player never made.
 *  2. `pickElection` and `resumeTraffic` write no log line at all, and `requestVia` logs
 *     "re-addressed" rather than "re-requested", so three real decisions were invisible.
 *  3. An action the level ignored still logged nothing but must also record nothing.
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, describeAction, tick } from "../src/index.ts";
import type { Action, GameState } from "../src/types.ts";
import { run } from "./helpers.ts";

/** Play a level passively (acknowledging beats) — the zero-decision baseline. */
function playPassive(scenarioId: string, seed: number, maxTicks = 40): GameState {
  let s = createInitialState(seed, { scenarioId });
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

describe("player move recording", () => {
  it("records nothing for a passive run — not even Phase 6's automatic re-attempt", () => {
    const s = playPassive("phase6", 140);
    // The engine's own recovery narration must not read as a player decision.
    expect(s.log.some((l) => /Re-attempting/.test(l.text))).toBe(true);
    expect(s.playerMoves).toEqual([]);
  });

  it("records nothing for acknowledgeBeat or a repeated arm", () => {
    let s = createInitialState(1, { scenarioId: "phase6" });
    s = apply(s, { type: "arm" });
    s = apply(s, { type: "arm" });
    s = apply(s, { type: "acknowledgeBeat" });
    expect(s.playerMoves).toEqual([]);
  });

  it("records nothing when setPolicy names a link the level does not have", () => {
    let s = createInitialState(1, { scenarioId: "phase6" });
    s = apply(s, { type: "setPolicy", linkId: "no-such-link", policy: "edf" });
    expect(s.playerMoves).toEqual([]);
  });

  it("records a setPolicy that took effect, with its tick", () => {
    const s = run({
      seed: 140,
      scenario: { scenarioId: "phase6" },
      actions: { 3: [{ type: "setPolicy", linkId: "bad", policy: "class" }] },
      maxTicks: 6,
    });
    expect(s.playerMoves).toHaveLength(1);
    expect(s.playerMoves[0]?.tick).toBe(3);
    expect(s.playerMoves[0]?.action.type).toBe("setPolicy");
    expect(s.playerMoves[0]?.label).toContain("CLASS");
  });

  // The three the old log regex could never see.
  it.each([
    ["phase3", { type: "pickElection", method: "static" } as Action],
    ["phase5", { type: "shedTraffic" } as Action],
    ["phase7", { type: "handBack" } as Action],
  ])("records %s's decision-gated action", (scenarioId, action) => {
    const s = run({ seed: 1, scenario: { scenarioId }, actions: { 4: [action] }, maxTicks: 8 });
    expect(s.playerMoves.map((m) => m.action.type)).toContain(action.type);
  });

  it("records requestVia, which logs 're-addressed' and so never matched the old regex", () => {
    const s = run({
      seed: 140,
      scenario: { scenarioId: "phase6" },
      actions: { 4: [{ type: "requestVia", nodeId: "acp2" }] },
      maxTicks: 8,
    });
    const move = s.playerMoves.find((m) => m.action.type === "requestVia");
    expect(move).toBeDefined();
    // Node ids resolve to their board label so the debrief reads like the board.
    expect(move?.label).toContain("ACP-2");
  });

  it("does not disturb determinism — moves carry no RNG cost", () => {
    const a = run({
      seed: 140,
      scenario: { scenarioId: "phase6" },
      actions: { 4: [{ type: "reroute" }] },
    });
    const b = run({
      seed: 140,
      scenario: { scenarioId: "phase6" },
      actions: { 4: [{ type: "reroute" }] },
    });
    expect(a.rngState).toBe(b.rngState);
    expect(a.playerMoves).toEqual(b.playerMoves);
  });
});

describe("describeAction", () => {
  const ALL: Action[] = [
    { type: "arm" },
    { type: "setPolicy", linkId: "bad", policy: "edf" },
    { type: "reroute" },
    { type: "rerequest" },
    { type: "requestVia", nodeId: "acp2" },
    { type: "refreshCop" },
    { type: "retry" },
    { type: "pickElection", method: "raft" },
    { type: "pickElection", method: "static" },
    { type: "shedTraffic" },
    { type: "resumeTraffic" },
    { type: "handBack" },
    { type: "mergeTeam" },
    { type: "acknowledgeBeat" },
  ];

  it("renders every Action variant as non-empty prose", () => {
    for (const a of ALL) {
      const label = describeAction(a);
      expect(label, a.type).toBeTruthy();
      // No variant may fall through to a raw type name.
      expect(label).not.toBe(a.type);
    }
  });

  it("falls back to the raw node id when no state is supplied", () => {
    expect(describeAction({ type: "requestVia", nodeId: "acp2" })).toContain("ACP2");
  });
});
