import { createHash } from "node:crypto";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level24, level24NaiveBrain, level24ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 2.4 "First Curve": CurveFollowing mode. The reference brain takes control then
// sends one MA_FlightCommandMT carrying a valid Curvature; FA flies the curvature-limited
// arc to the terminal and reports CURVE_COMPLETED. The naive brain commands a curvature
// tighter than the Mule's turn limit and FA REJECTS it with PERFORMANCE_LIMIT_EXCEEDED.

const MAX_STEPS = 500;

function solve(brain = level24ReferenceBrain): World {
  return run(initWorld(scenarioFor(level24, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 43;
const GOLDEN_SHA256 = "340c0786479dbd19d0ddd2b964ad554c46652cb4f69fd844b6a9387a691f0f14";

describe("level 2.4 golden run (reference brain)", () => {
  it("flies one valid curve to CURVE_COMPLETED and holds the terminal", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level24.objective.holdTicks);
    expect(
      w.log.some(
        (e) =>
          e.type === "MA_FlightActivityMT" &&
          (e.payload as { CurveStatus?: string }).CurveStatus === "CURVE_COMPLETED",
      ),
    ).toBe(true);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("sends the handshake plus exactly one curve command", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      {
        tick: 2,
        type: "MA_ControlRequestMT",
        payload: { RequestType: "ACQUIRE", CapabilityID: "MULE-01" },
      },
      {
        tick: 4,
        type: "MA_FlightCommandMT",
        payload: {
          CommandID: "CMD-1",
          CommandState: "NEW",
          CapabilityID: "MULE-01",
          Curvature: 0.002,
          Altitude: 3000,
          Speed: 25,
        },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level24.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 2.4 negative run (naive: over-tight curvature)", () => {
  it("FA REJECTS with PERFORMANCE_LIMIT_EXCEEDED and the curve never runs", () => {
    const w = solve(level24NaiveBrain);
    expect(w.outcome).toBe("failed");
    const status = w.log.find((e) => e.type === "MA_FlightCommandStatusMT");
    expect((status?.payload as { CommandProcessingState?: string }).CommandProcessingState).toBe(
      "REJECTED",
    );
    expect((status?.payload as { ValidationResult?: string }).ValidationResult).toBe(
      "PERFORMANCE_LIMIT_EXCEEDED",
    );
    expect(
      w.log.some(
        (e) =>
          e.type === "MA_FlightActivityMT" &&
          (e.payload as { CurveStatus?: string }).CurveStatus === "CURVE_COMPLETED",
      ),
    ).toBe(false);
  });
});
