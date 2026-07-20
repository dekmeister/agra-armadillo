/**
 * Levels-picker honesty guard (WP5.6).
 *
 * The picker's interface claim sits directly above a Play button, so it is a promise
 * about the level the player is about to load. It had quietly stopped being one:
 * Phase 1 advertised "MS-PNT" with no MS traffic anywhere in the scenario, Phase 8
 * advertised VI with no VI link, and Phases 2/3/4/5/7 each named a class their
 * scenario never spawned. Nothing caught it because the claim was free text.
 *
 * `Phase.classes` is now the machine-checkable half. This file plays every level on its
 * tutorial seed — passively and down its taught path — and holds all three in agreement:
 * the sim, `classes`, and the prose in `interfaces`.
 *
 * When this fails, decide which side is wrong. Adding the missing traffic is usually the
 * right fix (that is what WP5.6 did for L1's PNT exchange and L8's approach); dropping
 * the claim is the honest fallback. Editing only the prose is never the fix.
 */
import { describe, expect, it } from "vitest";
import { CAMPAIGN, classesForLevel } from "../../core/src/index.ts";
import type { InterfaceClass } from "../../core/src/types.ts";
import { PHASES, phaseByScenario } from "../src/lib/phases.ts";

/** Every class token, longest first so "P2P" is never matched as a stray "P". */
const ALL_CLASSES: InterfaceClass[] = ["P2P", "C2", "VI", "MS", "MP", "MD"];

/** Which class names the prose string mentions. `MS` deliberately matches "MS-PNT". */
function classesNamedIn(prose: string): Set<InterfaceClass> {
  const found = new Set<InterfaceClass>();
  for (const c of ALL_CLASSES) {
    if (new RegExp(`\\b${c}\\b`).test(prose)) found.add(c);
  }
  return found;
}

const sorted = (xs: Iterable<string>) => [...xs].sort();

describe("levels picker", () => {
  it("covers every campaign scenario exactly once", () => {
    expect(sorted(PHASES.map((p) => p.scenarioId))).toEqual(sorted(CAMPAIGN.map((d) => d.id)));
  });

  for (const def of CAMPAIGN) {
    const phase = phaseByScenario(def.id);

    it(`phase ${def.phase} declares exactly the interface classes its scenario spawns`, () => {
      expect(phase, `no picker entry for ${def.id}`).toBeDefined();
      if (!phase) return;
      const actual = classesForLevel(def.id, def.tutorialSeed);
      expect(sorted(phase.classes)).toEqual(sorted(actual));
    });

    it(`phase ${def.phase}'s picker prose names exactly the classes it declares`, () => {
      if (!phase) return;
      // The prose may dress a class up ("★C2 (LRE)", "MS-PNT") but may not invent one
      // or silently omit one — that is precisely how the old strings drifted.
      expect(sorted(classesNamedIn(phase.interfaces))).toEqual(sorted(phase.classes));
    });
  }

  it("never claims VI or MS-PNT crosses the air", () => {
    // Topology guard rail: on-platform lanes are on-platform. A level that names VI must
    // actually have an on-platform self-loop carrying it, not an OTA link relabelled.
    for (const def of CAMPAIGN) {
      const phase = phaseByScenario(def.id);
      if (!phase?.classes.includes("VI")) continue;
      expect(sorted(classesForLevel(def.id, def.tutorialSeed)), `${def.id} claims VI`).toContain(
        "VI",
      );
    }
  });
});
