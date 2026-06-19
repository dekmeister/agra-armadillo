import { createHash } from "node:crypto";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level34, level34NaiveBrain, level34ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 3.4 "In the Zone": the capstone — orchestrate FA and MS in one run. The reference
// brain takes FA control, commands a heading that angles the aircraft into the DLZ, requests
// the DLZ, then runs the 3.3 fire + consent chain. The MS engine holds the armed strike at
// ENABLED until the vehicle is inside the zone, then completes it. The log is long, so
// byte-stability is pinned with length + hash (level-1.4 style).

const MAX_STEPS = 500;

function solve(brain = level34ReferenceBrain): World {
  return run(initWorld(scenarioFor(level34, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 51;
const GOLDEN_SHA256 = "494d1d0f698534b17ee55c8a27a95f9c87b9a007ea8aceffa21cff147b850806";

describe("level 3.4 golden run (reference brain)", () => {
  it("completes the strike only after maneuvering FA into the launch zone", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.ms?.strikeTasks["TASK-1"]?.activityState).toBe("COMPLETED");
    // The win is geometric: the vehicle is inside the DLZ max range (500 m) of (1400,-800).
    const dx = w.vehicle.x - 1400;
    const dy = w.vehicle.y - -800;
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(500);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("issues the FA handshake, the DLZ request, and the MS fire + consent chain", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, to: e.to, type: e.type }));
    expect(sends).toEqual([
      { tick: 2, to: "FA", type: "MA_ControlRequestMT" },
      { tick: 4, to: "FA", type: "MA_FlightCommandMT" },
      { tick: 6, to: "MS", type: "DLZ_RequestMT" },
      { tick: 8, to: "MS", type: "MA_TaskMT" },
      { tick: 10, to: "MS", type: "MA_TaskCommandMT" },
      { tick: 14, to: "MS", type: "StrikeConsentRequestStatusMT" },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level34.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 3.4 negative run (naive bait brain)", () => {
  it("running the strike without closing the range never releases the weapon", () => {
    const w = solve(level34NaiveBrain);
    expect(w.outcome).not.toBe("won");
    // Consent was granted and the strike armed (ENABLED), but the vehicle stayed out of the
    // DLZ, so MS withheld completion — the geometry gate, not consent, is the blocker.
    expect(w.log.some((e) => e.type === "StrikeConsentRequestMT")).toBe(true);
    expect(w.ms?.strikeTasks["TASK-1"]?.activityState).toBe("ENABLED");
    const dx = w.vehicle.x - 1400;
    const dy = w.vehicle.y - -800;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(500);
  });
});
