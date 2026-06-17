import {
  aggregateWorst,
  initWorld,
  run,
  type Score,
  scoreWorld,
  type World,
} from "@brain-swap/core";
import { level45, level45LockedBrain, multiBodyScenarios } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 4.5 "Type Certificate": one locked brain, certified across the whole fleet.
// The brain runs unchanged on AX-01/AX-02/AX-03 and must win on every one; the level
// score is the worst-of-three (aggregateWorst).

const MAX_STEPS = 500;

function runs(): World[] {
  return multiBodyScenarios(level45, level45LockedBrain).map((s) => run(initWorld(s), MAX_STEPS));
}

const sendPayloads = (w: World) =>
  w.log.filter((e) => e.from === "MA").map((e) => ({ type: e.type, payload: e.payload }));

function lockedSendsFor(capId: string) {
  return [
    { type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: capId } },
    {
      type: "MA_FlightCommandMT",
      payload: {
        CommandID: "CMD-1",
        CommandState: "NEW",
        CapabilityID: capId,
        Heading: 270,
        Altitude: 3000,
        Speed: 40,
      },
    },
    {
      type: "MA_FlightCommandMT",
      payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: capId, Speed: 30 },
    },
  ];
}

const EXPECTED_SENDS_PER_BODY = [
  lockedSendsFor("MULE-01"),
  lockedSendsFor("HERON-02"),
  lockedSendsFor("FERRET-03"),
];

describe("level 4.5 type certificate (locked brain, full fleet)", () => {
  it("covers all bodies declared in the level", () => {
    expect(level45.bodies).toEqual(["ax-01", "ax-02", "ax-03"]);
    expect(runs()).toHaveLength(3);
  });

  it("the locked brain wins on every airframe", () => {
    for (const w of runs()) {
      expect(w.outcome).toBe("won");
      expect(w.holdTicks).toBeGreaterThanOrEqual(level45.objective.holdTicks);
    }
  });

  it("flies the identical command sequence on every airframe (CapabilityID varies per body)", () => {
    expect(runs().map(sendPayloads)).toEqual(EXPECTED_SENDS_PER_BODY);
  });

  it("per-body scores aggregate (worst-of-three) to par", () => {
    const scores: Score[] = runs().map(scoreWorld);
    expect(scores.map((s) => s.ticks)).toEqual([25, 28, 25]);
    expect(aggregateWorst(scores)).toEqual(level45.pars);
  });

  it("is deterministic: re-running yields byte-identical logs per body", () => {
    const a = runs().map((w) => JSON.stringify(w.log));
    const b = runs().map((w) => JSON.stringify(w.log));
    expect(a).toEqual(b);
  });
});
