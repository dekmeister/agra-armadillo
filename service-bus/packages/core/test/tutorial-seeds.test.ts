/**
 * Per-level tutorial seeds — the curated seed the view loads for each level. Locks the
 * `tutorialSeed` on every ScenarioDef so a balance change can't silently make a level's
 * opening seed teach the wrong thing. Each level's taught action must win on its seed
 * (and, where the level is loseable, passivity must lose) so the lesson lands.
 *
 * Phase 6's own seed is additionally locked by tutorial-seed.test.ts (the MVP slice).
 */
import { describe, expect, it } from "vitest";
import { apply, CAMPAIGN, createInitialState, getScenario, tick } from "../src/index.ts";
import type { Action, GameState } from "../src/types.ts";

/** Run a level on its own tutorial seed, applying a per-tick action chooser. */
function play(
  scenarioId: string,
  choose: (s: GameState) => Action | null,
  maxTicks = 40,
): GameState {
  const seed = getScenario(scenarioId).tutorialSeed;
  let s = createInitialState(seed, { scenarioId });
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    const a = choose(s);
    if (a) s = apply(s, a);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return s;
}

/** Passive: acknowledge beats only. */
const passive = (scenarioId: string) => play(scenarioId, () => null);

describe("per-level tutorial seeds", () => {
  it("every level in the campaign declares a tutorialSeed", () => {
    for (const def of CAMPAIGN) expect(Number.isFinite(def.tutorialSeed)).toBe(true);
  });

  it("L1 Launch — wins by observation on its seed", () => {
    expect(passive("phase1").outcome).toBe("win");
  });

  it("L2 Hold — passive loses, retrying MISSING_ACK wins", () => {
    expect(passive("phase2").outcome).toBe("loss");
    const won = play("phase2", (s) =>
      Object.values(s.messages).some(
        (m) => m.type === "MA_CommTeamReportMT" && m.state === "FAIL_MISSING_ACK",
      )
        ? { type: "retry" }
        : null,
    );
    expect(won.outcome).toBe("win");
  });

  it("L3 Team Formation — passive loses, picking a method wins", () => {
    expect(passive("phase3").outcome).toBe("loss");
    let picked = false;
    const won = play("phase3", () => {
      if (picked) return null;
      picked = true;
      return { type: "pickElection", method: "static" };
    });
    expect(won.outcome).toBe("win");
  });

  it("L4 Transit — passive (FIFO) loses, Class wins", () => {
    expect(passive("phase4").outcome).toBe("loss");
    let set = false;
    const won = play("phase4", () => {
      if (set) return null;
      set = true;
      return { type: "setPolicy", linkId: "form", policy: "class" };
    });
    expect(won.outcome).toBe("win");
  });

  it("L5 CAP — passive loses, shedding bulk wins", () => {
    expect(passive("phase5").outcome).toBe("loss");
    let shed = false;
    const won = play("phase5", () => {
      if (shed) return null;
      shed = true;
      return { type: "shedTraffic" };
    });
    expect(won.outcome).toBe("win");
  });

  it("L7 RTB — passive loses, handBack + re-elect + merge wins", () => {
    expect(passive("phase7").outcome).toBe("loss");
    let merged = false;
    const won = play("phase7", (s) => {
      if (s.pendingBeat?.id === "authority-handback") return { type: "handBack" };
      if (s.pendingBeat?.id === "split-brain") return { type: "pickElection", method: "static" };
      if (!merged && s.election?.leader && s.partition) {
        merged = true;
        return { type: "mergeTeam" };
      }
      return null;
    });
    expect(won.outcome).toBe("win");
  });

  it("L8 Land — wins by observation on its seed", () => {
    expect(passive("phase8").outcome).toBe("win");
  });
});
