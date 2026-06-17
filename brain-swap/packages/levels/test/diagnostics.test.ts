import type { Brain, LevelDef } from "@brain-swap/core";
import { evaluateDiagnostics, initWorld, run, type World } from "@brain-swap/core";
import {
  level11,
  level11NaiveBrain,
  level11ReferenceBrain,
  level12,
  level12ReferenceBrain,
  level13,
  level13NaiveBrain,
  level13ReferenceBrain,
  level14,
  level14ReferenceBrain,
  level22,
  level22NaiveBrain,
  level22ReferenceBrain,
  scenarioFor,
} from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// After-action diagnostics (packages/core/src/level/diagnostics.ts). The reference
// brains demonstrate each level's lesson cleanly; the naive bait brains fail it the
// documented way (ignored-not-controller / a real rejection reason / a no-fly breach).
// Lives here (not in packages/core/test) so it can drive real level brains without a
// core->levels dependency cycle.

const MAX_STEPS = 600;

function solve(level: LevelDef, brain: Brain): World {
  return run(initWorld(scenarioFor(level, brain)), MAX_STEPS);
}

const diag = (level: LevelDef, brain: Brain) => evaluateDiagnostics(solve(level, brain), [], level);

describe("diagnostics — reference brains demonstrate the lesson", () => {
  it("1.1 handshake: won, clean, no negative events; lesson text is the level's teaches", () => {
    const d = diag(level11, level11ReferenceBrain);
    expect(d.won).toBe(true);
    expect(d.lesson.demonstrated).toBe(true);
    expect(d.lesson.lesson).toBe(level11.teaches);
    expect(d.events.some((e) => e.id === "objective-met" && e.polarity === "positive")).toBe(true);
    expect(d.events.some((e) => e.polarity === "negative")).toBe(false);
  });

  it("1.2 reach-hold: demonstrated; no teaches ⇒ a per-kind fallback lesson", () => {
    const d = diag(level12, level12ReferenceBrain);
    expect(d.lesson.demonstrated).toBe(true);
    expect(level12.teaches).toBeUndefined();
    expect(d.lesson.lesson.length).toBeGreaterThan(0);
    expect(d.events.some((e) => e.id === "command-accepted" && e.polarity === "positive")).toBe(
      true,
    );
  });

  it("1.3 envelope: demonstrated, with no rejection in the recap", () => {
    const d = diag(level13, level13ReferenceBrain);
    expect(d.lesson.demonstrated).toBe(true);
    expect(d.events.some((e) => e.id === "command-rejected")).toBe(false);
  });

  it("1.4 racetrack: demonstrated (won within the bus-traffic par)", () => {
    const d = diag(level14, level14ReferenceBrain);
    expect(d.lesson.demonstrated).toBe(true);
  });

  it("2.2 threading the fence: demonstrated (won, no breach)", () => {
    const d = diag(level22, level22ReferenceBrain);
    expect(d.lesson.demonstrated).toBe(true);
    expect(d.events.some((e) => e.id === "run-failed")).toBe(false);
  });
});

describe("diagnostics — naive brains fail the lesson the documented way", () => {
  it("1.1 naive commands before control: not demonstrated, an ignored send appears", () => {
    const d = diag(level11, level11NaiveBrain);
    expect(d.won).toBe(false);
    expect(d.lesson.demonstrated).toBe(false);
    expect(d.events.some((e) => e.id === "send-ignored" && e.polarity === "negative")).toBe(true);
    expect(d.lesson.note).toContain("control");
  });

  it("1.3 naive busts the envelope: not demonstrated, PERFORMANCE_LIMIT_EXCEEDED surfaced", () => {
    const d = diag(level13, level13NaiveBrain);
    expect(d.lesson.demonstrated).toBe(false);
    expect(
      d.events.some(
        (e) => e.id === "command-rejected" && e.detail === "PERFORMANCE_LIMIT_EXCEEDED",
      ),
    ).toBe(true);
    expect(d.lesson.note).toContain("PERFORMANCE_LIMIT_EXCEEDED");
  });

  it("2.2 naive flies into the fence: not demonstrated, a no-fly breach is recorded", () => {
    const d = diag(level22, level22NaiveBrain);
    expect(d.won).toBe(false);
    expect(d.lesson.demonstrated).toBe(false);
    expect(d.events.some((e) => e.id === "run-failed" && e.polarity === "negative")).toBe(true);
  });
});

describe("diagnostics — determinism", () => {
  it("the same run yields byte-identical diagnostics", () => {
    const a = diag(level13, level13ReferenceBrain);
    const b = diag(level13, level13ReferenceBrain);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
