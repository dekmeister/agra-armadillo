/**
 * Phase 7 — RTB @ Bingo. Authority transfer + split-brain.
 *  - An RTB routed to the QB is REJECTED (RTB is the LRE's authority); handBack fixes it.
 *  - A partition orphans half the package; the orphan re-elects (reuse L3), and the
 *    halves must merge ON COMMAND — leaving it split loses.
 *
 * Loss-free links → deterministic outcomes.
 */
import { describe, expect, it } from "vitest";
import { apply, createInitialState, tick } from "../src/index.ts";
import type { GameState } from "../src/types.ts";

const p7 = { scenarioId: "phase7" };

/** Passive: acknowledge every beat, take no corrective action. */
function playPassive(seed = 1): GameState {
  let s = createInitialState(seed, p7);
  for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

/** Taught path: handBack the RTB, re-elect the orphan, then merge on command. */
function playTaught(seed = 1): GameState {
  let s = createInitialState(seed, p7);
  let merged = false;
  for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
    s = tick(s);
    if (s.pendingBeat?.id === "authority-handback") s = apply(s, { type: "handBack" });
    if (s.pendingBeat?.id === "split-brain")
      s = apply(s, { type: "pickElection", method: "static" });
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    // Once the orphan has re-elected a leader, heal the split on command.
    if (!merged && s.election?.leader && s.partition) {
      s = apply(s, { type: "mergeTeam" });
      merged = true;
    }
  }
  return s;
}

describe("Phase 7 — RTB @ Bingo", () => {
  it("an RTB routed to the QB is REJECTED and raises the hand-back beat", () => {
    let s = createInitialState(1, p7);
    let sawReject = false;
    for (let t = 1; t <= 5 && !sawReject; t++) {
      s = tick(s);
      if (s.seenBeats.includes("authority-handback")) sawReject = true;
    }
    expect(sawReject).toBe(true);
  });

  it("passivity loses — RTB unauthorised and the package left split", () => {
    const s = playPassive();
    expect(s.outcome).toBe("loss");
  });

  it("hand-back + re-elect + merge wins", () => {
    const s = playTaught();
    expect(s.outcome).toBe("win");
  });

  it("handBack authorises the RTB via the LRE role", () => {
    let s = createInitialState(1, p7);
    for (let t = 1; t <= 10 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "authority-handback") s = apply(s, { type: "handBack" });
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    const ixns = Object.values(s.interactions);
    const last = ixns[ixns.length - 1];
    const reply = last?.reply ? s.messages[last.reply] : null;
    expect(reply?.approval).toBe("APPROVED");
    expect(reply?.authorityVerified).toBe(true);
  });

  it("the orphan half re-elects ACP-2 as its local leader (split-brain)", () => {
    let s = createInitialState(1, p7);
    for (let t = 1; t <= 8 && !s.election?.leader; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "authority-handback") s = apply(s, { type: "handBack" });
      if (s.pendingBeat?.id === "split-brain")
        s = apply(s, { type: "pickElection", method: "static" });
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    expect(s.election?.leader).toBe("acp2");
    // Two leaders exist until merged (ACP-1 far side + ACP-2 orphan).
    expect(Object.values(s.nodes).filter((n) => n.isLeader).length).toBe(2);
  });

  it("re-electing but never merging still loses (merge only on command)", () => {
    let s = createInitialState(1, p7);
    for (let t = 1; t <= 30 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat?.id === "authority-handback") s = apply(s, { type: "handBack" });
      if (s.pendingBeat?.id === "split-brain")
        s = apply(s, { type: "pickElection", method: "static" });
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
      // deliberately never mergeTeam
    }
    expect(s.outcome).toBe("loss");
    expect(s.failReason).toContain("split-brain");
  });

  it("is deterministic per seed", () => {
    for (const seed of [1, 9, 40]) {
      expect(playTaught(seed).outcome).toBe(playTaught(seed).outcome);
      expect(playPassive(seed).outcome).toBe("loss");
    }
  });
});
