/**
 * Decision-beat mechanics: raised at the right transition, at most once each, and
 * acknowledging one is pure (no RNG advance — headless replays stay identical).
 */
import { describe, expect, it } from "vitest";
import { apply, tick } from "../src/index.ts";
import { DEFAULT_CONFIG } from "../src/scenario.ts";
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
