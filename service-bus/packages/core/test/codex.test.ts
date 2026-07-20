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
 *
 * The replay harness itself (`typesForLevel`, and the taught-path action choosers it
 * runs) lives in `src/replay.ts` — WP5's picker-honesty guard needs the same loop, and
 * two copies would be two things to keep in step.
 */
import { describe, expect, it } from "vitest";
import {
  CAMPAIGN,
  KNOWN_MESSAGE_NAMES,
  LIFECYCLE_SOURCE,
  MESSAGE_CODEX,
  REFERENCE_MESSAGE_NAMES,
  typesForLevel,
} from "../src/index.ts";
import type { MessageType } from "../src/types.ts";

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
