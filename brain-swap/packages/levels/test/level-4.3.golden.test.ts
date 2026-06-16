import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level43, level43NaiveBrain, level43ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 4.3 "Degraded": mid-mission FA re-advertises a tightened envelope (MinAirspeed
// 20 -> 30). The reference re-reads MA_FlightCapabilityMT and loiters at the NEW floor
// ({msg: MinAirspeed}); the naive caches the boot min (20) and is rejected, never
// slowing enough to hold the station.

const MAX_STEPS = 500;

function solve(brain = level43ReferenceBrain): World {
  return run(initWorld(scenarioFor(level43, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 89;
const GOLDEN_SHA256 = "64592276467643c7e0f13f8c9c898158bab7d1d193d02b75026adea46090a3c9";

describe("level 4.3 golden run (reference brain)", () => {
  it("re-reads the degraded envelope, loiters at the new floor, and wins", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level43.objective.holdTicks);
  });

  it("loiters at the re-advertised MinAirspeed (30), not the boot floor (20)", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "MULE-01" } },
      {
        tick: 4,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "NEW", CapabilityID: "MULE-01", Heading: 270, Altitude: 3000, Speed: 60 },
      },
      {
        tick: 16,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "MULE-01", Speed: 30 },
      },
    ]);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level43.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 4.3 negative run (naive brain that cached the boot envelope)", () => {
  it("commanding the boot MinAirspeed after the degrade is rejected and never wins", () => {
    const w = solve(level43NaiveBrain);
    expect(w.outcome).not.toBe("won");
    const rejected = w.log.find(
      (e) =>
        e.type === "MA_FlightCommandStatusMT" &&
        (e.payload as { CommandProcessingState?: string }).CommandProcessingState === "REJECTED",
    );
    expect(rejected).toBeDefined();
    expect((rejected!.payload as { ValidationResult?: string }).ValidationResult).toBe("PERFORMANCE_LIMIT_EXCEEDED");
  });
});
