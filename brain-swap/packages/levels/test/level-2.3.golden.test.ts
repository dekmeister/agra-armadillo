import { createHash } from "node:crypto";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level23, level23NaiveBrain, level23ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 2.3 "Retask": the 2.1 upload liturgy is reused to fly RTE-1, but a scheduled
// abort-route event cancels the running route mid-flight. The reference brain detects the
// RoutePlanExecutionStatusMT CANCELED reply and hand-flies an HSA MA_FlightCommandMT to the
// moved zone, then holds. The naive brain ignores CANCELED and times out (docs/03).

const MAX_STEPS = 500;

function solve(brain = level23ReferenceBrain): World {
  return run(initWorld(scenarioFor(level23, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 79;
const GOLDEN_SHA256 = "6c6777717a66cd1e6c2aad164b52bd86d6ac8d4176e1ade9844d2f058478f9bd";

describe("level 2.3 golden run (reference brain)", () => {
  it("flies the route, recovers from CANCELED via HSA, and holds the moved zone", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level23.objective.holdTicks);
    expect(
      w.log.some(
        (e) =>
          e.type === "RoutePlanExecutionStatusMT" &&
          (e.payload as { PlanExecutionState?: string }).PlanExecutionState === "CANCELED",
      ),
    ).toBe(true);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("sends the liturgy then exactly one HSA recovery vector", () => {
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
      {
        tick: 30,
        type: "MA_FlightCommandMT",
        payload: {
          CommandID: "CMD-1",
          CommandState: "NEW",
          CapabilityID: "MULE-01",
          Heading: 180,
          Altitude: 3000,
          Speed: 30,
        },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level23.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 2.3 negative run (naive: ignore CANCELED)", () => {
  it("receives CANCELED, sends no recovery vector, and times out", () => {
    const w = solve(level23NaiveBrain);
    expect(w.outcome).toBe("failed");
    expect(
      w.log.some(
        (e) =>
          e.type === "RoutePlanExecutionStatusMT" &&
          (e.payload as { PlanExecutionState?: string }).PlanExecutionState === "CANCELED",
      ),
    ).toBe(true);
    expect(w.log.some((e) => e.from === "MA" && e.type === "MA_FlightCommandMT")).toBe(false);
  });
});
