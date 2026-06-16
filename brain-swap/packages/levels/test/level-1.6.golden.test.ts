import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level16, level16NaiveBrain, level16ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 1.6 "Bingo": a distant station on a thin tank. FA validates commands against
// endurance, not just the envelope. The reference cruises at a sustainable speed that
// clears FA's reserve and still arrives before fuel-out; the naive max-throttle brain
// is rejected VIOLATION_ENDURANCE and never moves.

const MAX_STEPS = 500;

function solve(brain = level16ReferenceBrain): World {
  return run(initWorld(scenarioFor(level16, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 108;
const GOLDEN_SHA256 = "8b79ccd292fb1a7a4692139e5d0a0414bfd8a5fb697545a3c7979f5628fe8d21";

describe("level 1.6 golden run (reference brain)", () => {
  it("the sustainable-cruise brain reaches the far station and wins before fuel-out", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level16.objective.holdTicks);
    expect(w.vehicle.fuel).toBeGreaterThan(0); // arrived with reserve to spare
  });

  it("FA publishes endurance (NavigationReportMT) with fuel and percent", () => {
    const nav = solve().log.find((e) => e.type === "NavigationReportMT");
    expect(nav).toBeDefined();
    const p = nav!.payload as { Fuel?: number; Percent?: number };
    expect(typeof p.Fuel).toBe("number");
    expect(typeof p.Percent).toBe("number");
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("commands one sustainable cruise (NEW at the economical speed)", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "HERON-02" } },
      {
        tick: 7,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "NEW", CapabilityID: "HERON-02", Heading: 270, Altitude: 3000, Speed: 35 },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level16.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 1.6 negative run (naive max-throttle brain)", () => {
  it("commanding an unsustainable speed is rejected VIOLATION_ENDURANCE and never wins", () => {
    const w = solve(level16NaiveBrain);
    expect(w.outcome).not.toBe("won");
    const rejected = w.log.find(
      (e) =>
        e.type === "MA_FlightCommandStatusMT" &&
        (e.payload as { CommandProcessingState?: string }).CommandProcessingState === "REJECTED",
    );
    expect(rejected).toBeDefined();
    expect((rejected!.payload as { ValidationResult?: string }).ValidationResult).toBe("VIOLATION_ENDURANCE");
  });
});
