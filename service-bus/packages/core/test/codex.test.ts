/**
 * Message-codex drift guards (WP3).
 *
 * The Field Guide's codex is only worth having if it cannot go stale. Two
 * independent halves:
 *
 *  1. Compile time — MESSAGE_CODEX is typed `Record<MessageType, CodexEntry>`, so
 *     adding a message to the union without documenting it fails `tsc`. Nothing to
 *     assert here; it is enforced by the type.
 *  2. Run time — this file. Play every level on its tutorial seed, collect the
 *     message types that actually get spawned, and hold the codex to it in BOTH
 *     directions: no undocumented message may fly, and no entry may claim to be
 *     "exercised" if no level emits it.
 *
 * The second direction is the one that matters when WP5 changes traffic: if a level
 * stops emitting something, the codex is forced to stop advertising it.
 */
import { describe, expect, it } from "vitest";
import {
  apply,
  CAMPAIGN,
  createInitialState,
  KNOWN_MESSAGE_NAMES,
  LIFECYCLE_SOURCE,
  MESSAGE_CODEX,
  REFERENCE_MESSAGE_NAMES,
  tick,
} from "../src/index.ts";
import type { Action, GameState, MessageType } from "../src/types.ts";

/**
 * Play a level on its tutorial seed under a per-tick action chooser, acknowledging
 * beats so the clock keeps moving, and return every message type it spawned.
 * Mirrors the `play()` loop in tutorial-seeds.test.ts.
 */
function typesEmittedBy(
  scenarioId: string,
  seed: number,
  choose: (s: GameState) => Action | null,
  maxTicks = 60,
): Set<MessageType> {
  let s: GameState = createInitialState(seed, { scenarioId });
  const seen = new Set<MessageType>();
  const collect = () => {
    for (const m of Object.values(s.messages)) seen.add(m.type);
  };
  collect();
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    const a = choose(s);
    if (a) s = apply(s, a);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    collect();
  }
  return seen;
}

/**
 * The taught action for each level — the choice its Help text tells the player to
 * make, matching the winning paths locked in tutorial-seeds.test.ts. Needed because
 * some traffic only exists downstream of a decision: the election messages (L3, L7)
 * are never emitted under passive play, since passivity is precisely the losing
 * "never elect" branch. A codex built from passive play alone would wrongly conclude
 * MA_LeaderUpdateRequestMT is dead code.
 */
const TAUGHT: Record<string, () => (s: GameState) => Action | null> = {
  phase3: () => {
    let picked = false;
    return () => {
      if (picked) return null;
      picked = true;
      return { type: "pickElection", method: "static" };
    };
  },
  phase4: () => {
    let set = false;
    return () => {
      if (set) return null;
      set = true;
      return { type: "setPolicy", linkId: "form", policy: "class" };
    };
  },
  phase5: () => {
    let shed = false;
    return () => {
      if (shed) return null;
      shed = true;
      return { type: "shedTraffic" };
    };
  },
  phase6: () => {
    let rerouted = false;
    return (s) => {
      if (!rerouted && s.pendingBeat?.id === "missing-ack") {
        rerouted = true;
        return { type: "reroute" };
      }
      return null;
    };
  },
  phase7: () => {
    let merged = false;
    return (s) => {
      if (s.pendingBeat?.id === "authority-handback") return { type: "handBack" };
      if (s.pendingBeat?.id === "split-brain") return { type: "pickElection", method: "static" };
      if (!merged && s.election?.leader && s.partition) {
        merged = true;
        return { type: "mergeTeam" };
      }
      return null;
    };
  },
};

/**
 * Everything a level can put on the wire: passive play unioned with the taught
 * path. Both matter — passive covers baseline/background traffic that a quick
 * winning run may skip, the taught path covers decision-gated traffic.
 */
function typesForLevel(scenarioId: string, seed: number): Set<MessageType> {
  const all = typesEmittedBy(scenarioId, seed, () => null);
  const taught = TAUGHT[scenarioId];
  if (taught) {
    for (const t of typesEmittedBy(scenarioId, seed, taught())) all.add(t);
  }
  return all;
}

/** Union of everything the campaign puts on the wire, across all 8 levels. */
function campaignMessageTypes(): Set<MessageType> {
  const all = new Set<MessageType>();
  for (const def of CAMPAIGN) {
    for (const t of typesForLevel(def.id, def.tutorialSeed)) all.add(t);
  }
  return all;
}

describe("message codex", () => {
  it("documents every message type the campaign actually emits", () => {
    const undocumented = [...campaignMessageTypes()].filter((t) => !(t in MESSAGE_CODEX));
    expect(undocumented).toEqual([]);
  });

  it("does not claim a message is exercised unless some level emits it", () => {
    const emitted = campaignMessageTypes();
    const overclaimed = Object.entries(MESSAGE_CODEX)
      .filter(([type, e]) => e.status === "exercised" && !emitted.has(type as MessageType))
      .map(([type]) => type);
    expect(overclaimed).toEqual([]);
  });

  it("does not mark a message declared-only when it really flies", () => {
    const emitted = campaignMessageTypes();
    const understated = Object.entries(MESSAGE_CODEX)
      .filter(([type, e]) => e.status === "declared-only" && emitted.has(type as MessageType))
      .map(([type]) => type);
    expect(understated).toEqual([]);
  });

  it("lists the right levels for each exercised message", () => {
    // Per-level truth, not just the union — catches a message quietly moving levels.
    const byLevel = new Map<number, Set<MessageType>>();
    for (const def of CAMPAIGN) {
      byLevel.set(def.phase, typesForLevel(def.id, def.tutorialSeed));
    }
    for (const [type, entry] of Object.entries(MESSAGE_CODEX)) {
      if (entry.status !== "exercised") continue;
      const actual = [...byLevel.entries()]
        .filter(([, types]) => types.has(type as MessageType))
        .map(([phase]) => phase)
        .sort((a, b) => a - b);
      expect({ type, levels: [...entry.levels].sort((a, b) => a - b) }).toEqual({
        type,
        levels: actual,
      });
    }
  });

  it("requires a caveat wherever the name is not XSD-confirmed", () => {
    // An unconfirmed name must say so in the UI, or the guide would present a
    // coinage as though it were standard. This is the fidelity guard rail.
    for (const [type, entry] of Object.entries(MESSAGE_CODEX)) {
      if (entry.provenance === "unconfirmed") {
        expect(entry.caveat, `${type} is unconfirmed and must carry a caveat`).toBeTruthy();
      }
    }
  });

  it("justifies every reference-only name and keeps it out of the message table", () => {
    // Reference names are an allow-list for UI copy, not traffic. Each must state
    // why it earns a mention, and none may collide with a message the game sends.
    for (const [name, reason] of Object.entries(REFERENCE_MESSAGE_NAMES)) {
      expect(reason.length, `${name} needs a reason`).toBeGreaterThan(20);
      expect(name in MESSAGE_CODEX).toBe(false);
    }
  });

  it("keeps the lifecycle source out of the message table but in the known names", () => {
    // MA_TxDataPayloadCommandStatusMT defines the lifecycle; it is not a message the
    // game sends, so it must not be in MESSAGE_CODEX (it would fail the emit guard)
    // while still being a name UI copy is allowed to mention.
    expect(LIFECYCLE_SOURCE in MESSAGE_CODEX).toBe(false);
    expect(KNOWN_MESSAGE_NAMES).toContain(LIFECYCLE_SOURCE);
  });

  it("has no entry for the invented MA_VehicleCommandMT", () => {
    // Renamed to MA_FlightCommandMT in WP3 after the XSD check. Regression guard:
    // the old name does not exist in A-GRA and must never come back.
    expect(KNOWN_MESSAGE_NAMES).not.toContain("MA_VehicleCommandMT");
    expect(MESSAGE_CODEX.MA_FlightCommandMT.cls).toBe("VI");
  });
});
