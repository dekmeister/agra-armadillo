import { createHash } from "node:crypto";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level22, level22NaiveBrain, level22ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 2.2 "Threading the Fence": reach-hold with a no-fly circle on the direct line.
// The reference brain dog-legs (west, then a Direction-only UPDATE south) and crawls
// through the station clear of the fence; the naive straight-line brain breaches and
// the run fails — avoidance is world-state, never a rejection (docs/01).

const MAX_STEPS = 500;

function solve(brain = level22ReferenceBrain): World {
  return run(initWorld(scenarioFor(level22, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LEN = 67;
const GOLDEN_SHA256 = "0f8df5f84b8c9eca12abd3dc3468a5c59abacc1421320a35ff57ab9b6882ead6";

describe("level 2.2 golden run (reference brain)", () => {
  it("the dog-legging brain reaches the station and wins", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level22.objective.holdTicks);
  });

  it("never breaches the fence (no failed outcome along the way)", () => {
    // run() stops at the first terminal outcome; a clean win proves no tick failed.
    expect(solve().outcome).toBe("won");
  });

  it("produces a byte-stable golden log (length + hash)", () => {
    const proj = project(solve().log);
    expect(proj.length).toBe(GOLDEN_LEN);
    expect(createHash("sha256").update(proj.join("\n")).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("flies the dog-leg with one NEW then a Direction-only UPDATE south", () => {
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
          Heading: 270,
          Altitude: 3000,
          Speed: 25,
        },
      },
      {
        tick: 18,
        type: "MA_FlightCommandMT",
        payload: {
          CommandID: "CMD-1",
          CommandState: "UPDATE",
          CapabilityID: "MULE-01",
          Heading: 180,
        },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level22.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 2.2 negative run (naive straight-line brain)", () => {
  it("flying the direct line into the fence fails the run, with no rejection from FA", () => {
    const w = solve(level22NaiveBrain);
    expect(w.outcome).toBe("failed");
    // FA accepted the command — the failure is the breach, not a validation reject.
    expect(w.log.some((e) => e.disposition.kind === "rejected")).toBe(false);
    const cmd = w.log.find((e) => e.type === "MA_FlightCommandStatusMT");
    expect((cmd?.payload as { CommandProcessingState?: string }).CommandProcessingState).toBe(
      "ACCEPTED",
    );
  });
});
