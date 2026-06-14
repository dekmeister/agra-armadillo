import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level14, level14ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 1.4 "Racetrack by Hand": a four-corner waypoint sequence, steered by
// Direction-only UPDATEs at position thresholds. The run is long (~290 messages),
// so byte-stability is pinned with a hash rather than an inline log.

const MAX_STEPS = 1000;

function solve(): World {
  return run(initWorld(scenarioFor(level14, level14ReferenceBrain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 284;
const GOLDEN_SHA256 = "a646bf0c7aa57a4e79deff0ba697cd6aa9c08295551dad0a9a6a2c2a4e24cff9";

describe("level 1.4 golden run (reference brain)", () => {
  it("the reference brain flies the circuit and wins", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.waypointIndex).toBe(level14.objective.kind === "waypoint-sequence" ? level14.objective.waypoints.length - 1 : -1);
    expect(w.holdTicks).toBeGreaterThanOrEqual(level14.objective.holdTicks);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("steers each corner with a Direction-only UPDATE (one NEW, then Heading-only amendments)", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "MULE-01" } },
      {
        tick: 4,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "NEW", CapabilityID: "MULE-01", Heading: 270, Altitude: 3000, Speed: 25 },
      },
      {
        tick: 47,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "MULE-01", Heading: 180 },
      },
      {
        tick: 102,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "MULE-01", Heading: 90 },
      },
      {
        tick: 169,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "MULE-01", Heading: 0 },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level14.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });

  it("never rejects a command or sends while uncontrolled", () => {
    expect(solve().log.some((e) => e.disposition.kind !== "delivered")).toBe(false);
  });
});
