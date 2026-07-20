/**
 * Locks the clamped tutorial seed (scenario.TUTORIAL_SEED). Simulates the ACTUAL
 * paused-decision flow — the player acts at the beat that prompts the action, then
 * resumes — and asserts the lesson always lands: do-nothing raises all three beats
 * and loses; EDF / Class / reroute each win; the re-request trap loses.
 *
 * If scenario balance changes and this breaks, re-find a seed satisfying these
 * criteria (a scan over a few thousand seeds yields several) and update TUTORIAL_SEED.
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import { TUTORIAL_SEED } from "../src/scenario.ts";
import type { Action, BeatId, GameState } from "../src/types.ts";

type Strat = "none" | "edf" | "class" | "reroute" | "rerequest" | "acp3";

/** What the player does when a given beat appears, for each strategy. */
function actionFor(strat: Strat, beat: BeatId): Action | null {
  if (strat === "edf" && beat === "queue-starved")
    return { type: "setPolicy", linkId: "bad", policy: "edf" };
  if (strat === "class" && beat === "queue-starved")
    return { type: "setPolicy", linkId: "bad", policy: "class" };
  if (strat === "reroute" && beat === "missing-ack") return { type: "reroute" };
  if (strat === "rerequest" && beat === "missing-ack") return { type: "rerequest" };
  if (strat === "acp3" && beat === "missing-ack") return { type: "requestVia", nodeId: "acp3" };
  return null;
}

/** Play the seed through the paused-decision flow under a strategy. */
function play(strat: Strat, maxTicks = 60): GameState {
  let s = createInitialState(TUTORIAL_SEED, { config: { mode: "tutorial" } });
  s = apply(s, { type: "arm" });
  for (let t = 1; t <= maxTicks; t++) {
    s = tick(s);
    if (s.pendingBeat) {
      const a = actionFor(strat, s.pendingBeat.id);
      if (a) s = apply(s, a);
      s = apply(s, { type: "acknowledgeBeat" }); // resume
    }
    if (s.outcome !== "pending") break;
  }
  return s;
}

describe("the clamped tutorial seed", () => {
  it("doing nothing raises all three beats in order and loses", () => {
    const s = play("none");
    expect(s.seenBeats).toEqual(["link-degraded", "queue-starved", "missing-ack"]);
    expect(s.outcome).toBe("loss");
  });

  it("re-prioritising the BAD link to EDF at the queue-starved beat wins", () => {
    expect(play("edf").outcome).toBe("win");
  });

  it("re-prioritising to Class wins", () => {
    expect(play("class").outcome).toBe("win");
  });

  it("rerouting at the missing-ack beat wins", () => {
    expect(play("reroute").outcome).toBe("win");
  });

  it("the re-request trap (re-routes onto the same BAD link) loses", () => {
    expect(play("rerequest").outcome).toBe("loss");
  });

  it("asking ACP-3 loses BY REJECTION — the wrong-authority trap (WP5.3)", () => {
    // The point of this branch is that it must fail for the RBAC reason, not by running
    // out of clock: the request reaches ACP-3 over a clean link, perfectly, and is
    // refused because an AVC is not the Target Authority. If a retune ever makes this
    // lose on the WEZ deadline instead, the lesson silently becomes "that path was too
    // slow" rather than "that node was never allowed to answer".
    const s = play("acp3");
    expect(s.outcome).toBe("loss");
    const replies = Object.values(s.interactions)
      .map((i) => i.reply)
      .filter((id): id is string => !!id)
      .map((id) => s.messages[id]);
    const rejected = replies.find((m) => m?.approval === "REJECTED");
    expect(rejected, "no REJECTED reply — the RBAC gate never fired").toBeTruthy();
    expect(rejected?.authorityVerified).toBe(false);
    expect(s.failReason ?? "").toMatch(/authority/i);
  });
});
