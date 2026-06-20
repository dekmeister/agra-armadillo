import {
  type BodyProfile,
  type LevelDef,
  type MA_MissionPlanActivationCommandMT,
  type MessageLogEntry,
  makeScenario,
  msg,
  replayScript,
  type ScriptedInput,
  validateCurveCommand,
  type World,
} from "@brain-swap/core";
import { describe, expect, it } from "vitest";

// Route-plan activation liturgy + curve validation (World 2). The activation state
// machine lives in the FA engine (handleActivationCommand): a well-ordered step
// advances the plan; a step out of order replies a *_FAILED state; DEACTIVATE while
// the route is EXECUTING is illegal (VI §1.2.5.4) and the route keeps running. Curve
// validation is the stateless validator (validateCurveCommand). All driven through the
// realtime path (replayScript) so it replays deterministically (CLAUDE.md rule #3).

// AX-01-flavoured trainer body with a curve capability (min radius ~250 m → maxCurvature
// 0.004). Instant approval, publication off so the log is just control + liturgy traffic.
const body: BodyProfile = {
  id: "route-test",
  name: "Route Test Mule",
  capabilities: [
    {
      id: "MULE-01",
      type: "HSA_CSA",
      profile: { minAltitude: 0, maxAltitude: 12000, minAirspeed: 20, maxAirspeed: 140 },
    },
  ],
  flight: { maxTurnRateDeg: 6, maxClimbRate: 50, maxAccel: 20 },
  control: { approvalLatencyTicks: 0 },
  publish: { positionIntervalTicks: 0, activityIntervalTicks: 0 },
  start: { x: 0, y: 0, altitude: 3000, heading: 270, speed: 30 },
  curve: { maxCurvature: 0.004 },
};

// A body with no curve capability (otherwise identical) for the CAPABILITY_NOT_SUPPORTED case.
const curvelessBody: BodyProfile = { ...body, curve: undefined };

/** A level carrying RTE-1; objective never wins so the run is a fixed window. */
function routeLevel(): LevelDef {
  return {
    id: "route-test",
    title: "Route Test",
    body: "route-test",
    capabilityId: "MULE-01",
    objective: { kind: "hold-control", holdTicks: 999 },
    maxTicks: 40,
    routes: [
      {
        id: "RTE-1",
        legs: [{ x: -800, y: 0, altitude: 3000, speed: 30 }],
        loiter: { x: -1200, y: -500, radius: 220, altitude: 3000, speed: 25 },
      },
    ],
  };
}

const acquire = msg("MA_ControlRequestMT", "MA", "FA", {
  RequestType: "ACQUIRE",
  CapabilityID: "MULE-01",
});
const activation = (cmd: MA_MissionPlanActivationCommandMT["ActivationCommand"]) =>
  msg("MA_MissionPlanActivationCommandMT", "MA", "FA", {
    CommandID: "MPC-1",
    RoutePlanID: "RTE-1",
    ActivationCommand: cmd,
  });
const routePlan = msg("MA_RoutePlanMT", "MA", "FA", {
  RoutePlanID: "RTE-1",
  OrbitShape: "RACETRACK",
});

const run = (script: ScriptedInput[], steps = 40): World =>
  replayScript(makeScenario(body, { level: routeLevel() }), script, steps).at(-1)!;

const activationStatuses = (log: readonly MessageLogEntry[]) =>
  log
    .filter((e) => e.type === "MA_MissionPlanActivationCommandStatusMT")
    .map((e) => (e.payload as { ActivationState?: string }).ActivationState);
const execStates = (log: readonly MessageLogEntry[]) =>
  log
    .filter((e) => e.type === "RoutePlanExecutionStatusMT")
    .map((e) => (e.payload as { PlanExecutionState?: string }).PlanExecutionState);

describe("route activation liturgy", () => {
  it("DEACTIVATE while EXECUTING fails and the route keeps running (VI §1.2.5.4)", () => {
    // Walk the liturgy to EXECUTING, then try to DEACTIVATE the running route.
    const script: ScriptedInput[] = [
      { tick: 1, message: acquire },
      { tick: 2, message: activation("PREPARE_FOR_UPLOAD") }, // → READY_FOR_UPLOAD @ t3
      { tick: 3, message: routePlan }, // uploaded=true @ t4
      { tick: 4, message: activation("UPLOAD") }, // → UPLOADED @ t5
      { tick: 5, message: activation("PREPARE_FOR_ACTIVATION") }, // → READY_FOR_ACTIVATION @ t6
      { tick: 6, message: activation("ACTIVATE") }, // → ACTIVATED + EXECUTING @ t7
      { tick: 9, message: activation("DEACTIVATE") }, // illegal while EXECUTING @ t10
    ];
    const w = run(script, 14);

    // The DEACTIVATE replied DEACTIVATION_FAILED and emitted a FAILED execution status.
    const deactStatus = w.log
      .filter((e) => e.type === "MA_MissionPlanActivationCommandStatusMT")
      .at(-1)!;
    expect((deactStatus.payload as { ActivationState?: string }).ActivationState).toBe(
      "DEACTIVATION_FAILED",
    );
    expect(execStates(w.log)).toContain("FAILED");

    // But the route is still EXECUTING (the engine ignored the illegal DEACTIVATE).
    expect(w.fa.routePlans["RTE-1"]?.executionState).toBe("EXECUTING");
    expect(w.fa.executingRouteId).toBe("RTE-1");
  });

  it("UPLOAD before PREPARE_FOR_UPLOAD replies UPLOAD_FAILED (out of order)", () => {
    const script: ScriptedInput[] = [
      { tick: 1, message: acquire },
      { tick: 2, message: routePlan }, // plan present, but liturgy not prepared
      { tick: 3, message: activation("UPLOAD") }, // out of order → UPLOAD_FAILED
    ];
    const w = run(script, 8);
    expect(activationStatuses(w.log)).toEqual(["UPLOAD_FAILED"]);
    expect(w.fa.routePlans["RTE-1"]?.activationState).not.toBe("UPLOADED");
  });
});

describe("curve command validation", () => {
  const curveCmd = (curvature: number) => ({
    CommandID: "CMD-1",
    CommandState: "NEW" as const,
    CapabilityID: "MULE-01",
    Altitude: 3000,
    Speed: 30,
    Curvature: curvature,
  });

  it("accepts a curvature within the body's limit", () => {
    const out = validateCurveCommand(body, curveCmd(0.002));
    expect(out.accepted).toBe(true);
    expect(out.result).toBe("FLIGHT_COMMAND_VALID");
  });

  it("rejects an over-tight curvature with PERFORMANCE_LIMIT_EXCEEDED", () => {
    const out = validateCurveCommand(body, curveCmd(0.01));
    expect(out).toEqual({ accepted: false, result: "PERFORMANCE_LIMIT_EXCEEDED" });
  });

  it("rejects a curve on a curveless body with CAPABILITY_NOT_SUPPORTED", () => {
    const out = validateCurveCommand(curvelessBody, curveCmd(0.002));
    expect(out).toEqual({ accepted: false, result: "CAPABILITY_NOT_SUPPORTED" });
  });
});
