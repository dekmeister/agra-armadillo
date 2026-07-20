/**
 * Decision-beat mechanics: raised at the right transition, at most once each, and
 * acknowledging one is pure (no RNG advance — headless replays stay identical).
 */
import { describe, expect, it } from "vitest";
import { apply, tick } from "../src/index.ts";
import { CAMPAIGN, DEFAULT_CONFIG } from "../src/scenario.ts";
import { run } from "./helpers.ts";

describe("decision beats", () => {
  it("raises link-degraded exactly at the contingency tick", () => {
    // Stop the tick that fires the contingency; the beat should be standing.
    const s = run({
      seed: 1,
      actions: { 0: [{ type: "arm" }] },
      maxTicks: DEFAULT_CONFIG.contingencyTick,
    });
    expect(s.pendingBeat?.id).toBe("link-degraded");
    expect(s.pendingBeat?.tick).toBe(DEFAULT_CONFIG.contingencyTick);
    expect(s.seenBeats).toContain("link-degraded");
  });

  it("never raises the same beat id twice", () => {
    // Acknowledge every beat as it appears; ids must stay unique.
    let s = run({ seed: 1412, actions: { 0: [{ type: "arm" }] }, maxTicks: 0 });
    for (let t = 1; t <= 40 && s.outcome === "pending"; t++) {
      s = tick(s);
      if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    }
    expect(new Set(s.seenBeats).size).toBe(s.seenBeats.length);
  });

  it("acknowledgeBeat clears the beat without advancing the RNG", () => {
    const s = run({
      seed: 1,
      actions: { 0: [{ type: "arm" }] },
      maxTicks: DEFAULT_CONFIG.contingencyTick,
    });
    expect(s.pendingBeat).not.toBeNull();
    const rngBefore = s.rngState;
    const after = apply(s, { type: "acknowledgeBeat" });
    expect(after.pendingBeat).toBeNull();
    expect(after.rngState).toBe(rngBefore);
  });
});

/**
 * WP6.4. The debrief used to render its beat lines from two hand-maintained lookup maps in
 * the view, which produced a literal "undefined — undefined" for any beat nobody remembered
 * to add, and let a lesson restate its own title — Phase 2's printed
 * "FAIL_MISSING_ACK — FAIL_MISSING_ACK — …". Moving `takeaway` onto `Beat` makes the first
 * a compile error; these keep the second from creeping back.
 */
describe("beat copy", () => {
  const ALL = CAMPAIGN.flatMap((def) =>
    Object.values(def.beats).map((b) => ({ level: def.id, beat: b })),
  );

  it("every beat carries a non-empty takeaway", () => {
    expect(ALL.length).toBeGreaterThan(0);
    for (const { level, beat } of ALL) {
      expect(beat.takeaway.trim(), `${level}/${beat.id}`).not.toBe("");
    }
  });

  it("no takeaway simply restates its own title", () => {
    for (const { level, beat } of ALL) {
      const head = beat.title.split("—")[0]?.trim() ?? beat.title;
      expect(beat.takeaway.startsWith(head), `${level}/${beat.id}`).toBe(false);
    }
  });

  it("every level states a principle for the Objective card", () => {
    for (const def of CAMPAIGN) {
      expect(def.principle.trim(), def.id).not.toBe("");
    }
  });

  it("no two levels share a principle — it must say what THIS level teaches", () => {
    const seen = CAMPAIGN.map((d) => d.principle);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
