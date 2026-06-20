import { createHash } from "node:crypto";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level21, level21NaiveBrain, level21ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 2.1 "Upload": the route-plan upload/activation liturgy. The reference brain
// walks PREPARE_FOR_UPLOAD → (plan) UPLOAD → PREPARE_FOR_ACTIVATION → ACTIVATE in order;
// FA then flies RTE-1 to its loiter and reports COMPLETE. The naive brain jumps straight
// to ACTIVATE and FA replies ACTIVATION_FAILED — the route never runs (docs/03).

const MAX_STEPS = 500;

function solve(brain = level21ReferenceBrain): World {
  return run(initWorld(scenarioFor(level21, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 70;
const GOLDEN_SHA256 = "2fff2f2e000e11a1f3656ded4280314e21805ba51671be1a4ef0b8f0dbdfb5fa";

describe("level 2.1 golden run (reference brain)", () => {
  it("walks the liturgy and FA flies the route to COMPLETE", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level21.objective.holdTicks);
    expect(
      w.log.some(
        (e) =>
          e.type === "RoutePlanExecutionStatusMT" &&
          (e.payload as { PlanExecutionState?: string }).PlanExecutionState === "COMPLETE",
      ),
    ).toBe(true);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("sends exactly the handshake + ordered liturgy (no hand-flown vectors)", () => {
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
        type: "MA_MissionPlanActivationCommandMT",
        payload: {
          CommandID: "MPC-1",
          RoutePlanID: "RTE-1",
          ActivationCommand: "PREPARE_FOR_UPLOAD",
        },
      },
      {
        tick: 6,
        type: "MA_RoutePlanMT",
        payload: { RoutePlanID: "RTE-1", OrbitShape: "RACETRACK" },
      },
      {
        tick: 6,
        type: "MA_MissionPlanActivationCommandMT",
        payload: { CommandID: "MPC-1", RoutePlanID: "RTE-1", ActivationCommand: "UPLOAD" },
      },
      {
        tick: 8,
        type: "MA_MissionPlanActivationCommandMT",
        payload: {
          CommandID: "MPC-1",
          RoutePlanID: "RTE-1",
          ActivationCommand: "PREPARE_FOR_ACTIVATION",
        },
      },
      {
        tick: 10,
        type: "MA_MissionPlanActivationCommandMT",
        payload: { CommandID: "MPC-1", RoutePlanID: "RTE-1", ActivationCommand: "ACTIVATE" },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level21.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 2.1 negative run (naive: ACTIVATE without uploading)", () => {
  it("FA replies ACTIVATION_FAILED and the route never executes", () => {
    const w = solve(level21NaiveBrain);
    expect(w.outcome).toBe("failed");
    const status = w.log.find((e) => e.type === "MA_MissionPlanActivationCommandStatusMT");
    expect((status?.payload as { ActivationState?: string }).ActivationState).toBe(
      "ACTIVATION_FAILED",
    );
    expect(w.log.some((e) => e.type === "RoutePlanExecutionStatusMT")).toBe(false);
  });
});
