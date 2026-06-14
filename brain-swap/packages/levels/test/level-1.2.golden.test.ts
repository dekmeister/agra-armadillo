import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level12, level12ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Build-order step 4, the definition of done: the hand-written reference brain
// solves level 1.2 in a deterministic, byte-stable golden run — the level is
// provably solvable before any UI exists (docs/05).

const MAX_STEPS = 500;

function solve(): World {
  return run(initWorld(scenarioFor(level12, level12ReferenceBrain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

// The full message log, byte-for-byte, is the golden artifact.
const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t2 MA->FA MA_ControlRequestMT [delivered]",
  "t2 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 FA->MA MA_ControlRequestStatusMT [delivered]",
  "t3 FA->MA ControlStatusMT [delivered]",
  "t3 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t4 MA->FA MA_FlightCommandMT [delivered]",
  "t4 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t5 FA->MA MA_FlightCommandStatusMT [delivered]",
  "t5 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 FA->MA MA_FlightActivityMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t9 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t10 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 FA->MA MA_FlightActivityMT [delivered]",
  "t12 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t13 MA->FA MA_FlightCommandMT [delivered]",
  "t13 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t14 FA->MA MA_FlightCommandStatusMT [delivered]",
  "t14 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t15 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t16 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t16 FA->MA MA_FlightActivityMT [delivered]",
  "t17 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t18 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t19 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t20 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t21 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t21 FA->MA MA_FlightActivityMT [delivered]",
  "t22 FA->MA MA_PositionReportDetailedMT [delivered]",
];

describe("level 1.2 golden run (reference brain)", () => {
  it("the reference brain wins the level", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level12.objective.holdTicks);
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("the brain emits exactly the handshake → command → loiter sequence", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "MULE-01" } },
      {
        tick: 4,
        type: "MA_FlightCommandMT",
        payload: {
          CommandID: "CMD-1",
          CommandState: "NEW",
          CapabilityID: "MULE-01",
          Heading: 270,
          Altitude: 3000,
          Speed: 60,
        },
      },
      {
        tick: 13,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "MULE-01", Speed: 20 },
      },
    ]);
  });

  it("produces stable scores", () => {
    expect(scoreWorld(solve())).toEqual({ ticks: 22, busTraffic: 3, rejections: 0, brainSize: 9 });
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });

  it("never rejects a command or sends while uncontrolled", () => {
    const w = solve();
    expect(w.log.some((e) => e.disposition.kind !== "delivered")).toBe(false);
  });
});
