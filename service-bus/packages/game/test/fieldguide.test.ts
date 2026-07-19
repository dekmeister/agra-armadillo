/**
 * Field Guide content guards (WP3).
 *
 * WP3's acceptance criterion is that *every acronym in the UI is resolvable
 * in-game*. A regex for capitalised tokens across the view would be too noisy to be
 * a stable gate (it would flag SENT, PENDING, GOOD, WEZ-adjacent copy and every
 * enum value), so instead this pins a curated required set — the acronyms the game
 * actually puts on screen — and fails if one loses its glossary entry.
 */
import { describe, expect, it } from "vitest";
import { MESSAGE_CODEX } from "../../core/src/index.ts";
import {
  ELECTION_METHODS,
  GLOSSARY,
  INTERFACES,
  LIFECYCLE_STATES,
  PROVENANCE_LABEL,
  ROLES,
  SECTIONS,
} from "../src/lib/fieldguide.ts";

/** Acronyms that appear in the HUD, picker, beats, Inspector or debriefs. */
const REQUIRED_TERMS = [
  "ACP",
  "A-GRA",
  "ASB",
  "AVC",
  "C2",
  "CAP",
  "COP",
  "DCA",
  "DDS",
  "DMS",
  "EDF",
  "FA",
  "L1",
  "LRE",
  "MA",
  "MD",
  "MP",
  "MS",
  "OV-1",
  "P2P",
  "PNT",
  "QB",
  "RBAC",
  "ROE",
  "RTB",
  "VI",
  "WEZ",
];

describe("field guide", () => {
  it("resolves every acronym the UI puts on screen", () => {
    const known = new Set(GLOSSARY.map((g) => g.term));
    expect(REQUIRED_TERMS.filter((t) => !known.has(t))).toEqual([]);
  });

  it("has no duplicate glossary terms", () => {
    const terms = GLOSSARY.map((g) => g.term);
    expect(terms.length).toBe(new Set(terms).size);
  });

  it("explains itself wherever an expansion is missing or unverified", () => {
    // A blank expansion without a note reads as an oversight; with one it reads as
    // the deliberate refusal to guess that it is. Likewise anything unverified.
    for (const row of GLOSSARY) {
      if (row.expansion === null || row.prov !== "ask") {
        expect(row.note, `${row.term} needs a note explaining its provenance`).toBeTruthy();
      }
    }
  });

  it("does not invent an expansion for AVC", () => {
    // No A-GRA source on this device gives one. The schema's "Unmanned Air Vehicle
    // Control Station" is a different concept and must not be borrowed. VERIFY C3.
    const avc = GLOSSARY.find((g) => g.term === "AVC");
    expect(avc?.expansion).toBeNull();
    expect(ROLES.find((r) => r.code === "AVC")?.expansion).toBeNull();
  });

  it("covers all six L1 interfaces exactly once, with the classes the sim uses", () => {
    expect(INTERFACES).toHaveLength(6);
    const codes = INTERFACES.map((i) => i.code).sort();
    expect(codes).toEqual(["C2", "MD", "MP", "MS", "P2P", "VI"]);
    // Every class the codex assigns to a message must be a documented interface.
    const used = new Set(Object.values(MESSAGE_CODEX).map((e) => e.cls));
    for (const cls of used) expect(codes).toContain(cls);
  });

  it("keeps the topology guard rail: VI is never over the air", () => {
    // The one column that must never be wrong. VI being on-platform is the whole
    // lesson of L1/L2 and the correction the project's CLAUDE.md calls out.
    expect(INTERFACES.find((i) => i.code === "VI")?.air).toBe("On-platform");
    expect(INTERFACES.find((i) => i.code === "C2")?.air).toBe("OTA");
    expect(INTERFACES.find((i) => i.code === "P2P")?.air).toBe("OTA");
    expect(MESSAGE_CODEX.MA_FlightCommandMT.cls).toBe("VI");
  });

  it("shows the two real success states the game does not implement", () => {
    // If these ever vanish, the guide is back to teaching SENT as though it were
    // A-GRA's word for success. docs/01 item 21.
    const absent = LIFECYCLE_STATES.filter((s) => !s.inGame).map((s) => s.state);
    expect(absent).toEqual(["SUCCESS_NO_ACK_EXPECTED", "SUCCESS_RECEIVED_ACK"]);
    expect(LIFECYCLE_STATES.some((s) => s.state === "SENT")).toBe(false);
  });

  it("names all five election methods and marks the two that ship", () => {
    expect(ELECTION_METHODS).toHaveLength(5);
    const shipped = ELECTION_METHODS.filter((m) => m.implemented).map((m) => m.name);
    expect(shipped.sort()).toEqual(["Raft", "Static Fitness Score"]);
  });

  it("lists the five RBAC roles", () => {
    expect(ROLES.map((r) => r.code)).toEqual(["Admin", "QB", "AVC", "LRE", "Observer"]);
  });

  it("has a label for every provenance value and unique section ids", () => {
    expect(Object.keys(PROVENANCE_LABEL).sort()).toEqual(["ask", "assert", "external", "inferred"]);
    const ids = SECTIONS.map((s) => s.id);
    expect(ids.length).toBe(new Set(ids).size);
    expect(SECTIONS).toHaveLength(8);
  });
});
