import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level42, level42NaiveBrain, level42ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 4.2 "The Flinch": a threat pops up on the Ferret's track and FA takes the
// aircraft with a CAUTION MA_FaultMT. The reference yields — dog-legs south, runs west
// past the hazard, then climbs north through the station. A brain that ignores the
// fault is held clear and never arrives (it times out).

const MAX_STEPS = 500;

function solve(brain = level42ReferenceBrain): World {
  return run(initWorld(scenarioFor(level42, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 105;
const GOLDEN_SHA256 = "dfac1e9750258cd6350ed85913418693e74ef1afaae2ad0a4bd73a452a52fd8e";

describe("level 4.2 golden run (reference brain)", () => {
  it("yields to the collision interrupt, dog-legs around the threat, and wins", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level42.objective.holdTicks);
  });

  it("FA raises a CAUTION MA_FaultMT when the direct vector threatens the hazard", () => {
    const fault = solve().log.find((e) => e.type === "MA_FaultMT");
    expect(fault).toBeDefined();
    expect((fault!.payload as { Severity?: string }).Severity).toBe("CAUTION");
  });

  it("flies the handshake, a cruise, and three clearing dog-leg amendments", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "FERRET-03" } },
      {
        tick: 4,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "NEW", CapabilityID: "FERRET-03", Heading: 270, Altitude: 3000, Speed: 50 },
      },
      { tick: 12, type: "MA_FlightCommandMT", payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "FERRET-03", Heading: 180 } },
      { tick: 25, type: "MA_FlightCommandMT", payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "FERRET-03", Heading: 270 } },
      { tick: 54, type: "MA_FlightCommandMT", payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "FERRET-03", Heading: 0 } },
    ]);
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("never breaches the threat and produces stable scores equal to par", () => {
    expect(solve().outcome).toBe("won"); // a clean win proves no tick breached the threat
    expect(scoreWorld(solve())).toEqual(level42.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 4.2 negative run (naive brain that ignores the fault)", () => {
  it("ignoring the CAUTION leaves FA holding the aircraft clear; the run never wins", () => {
    const w = solve(level42NaiveBrain);
    expect(w.outcome).not.toBe("won");
    // FA did flinch (raised the fault) but the brain never commanded a clear vector.
    expect(w.log.some((e) => e.type === "MA_FaultMT")).toBe(true);
  });
});
