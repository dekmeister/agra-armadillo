import { describe, expect, it } from "vitest";
import type { Action } from "../src/types.ts";
import { run, winRate } from "./helpers.ts";

const armOnly = (): Record<number, Action[]> => ({ 0: [{ type: "arm" }] });
const edfAt = (t: number) => (): Record<number, Action[]> => ({
  0: [{ type: "arm" }],
  [t]: [{ type: "setPolicy", linkId: "bad", policy: "edf" }],
});
const rerouteAt = (t: number) => (): Record<number, Action[]> => ({
  0: [{ type: "arm" }],
  [t]: [{ type: "reroute" }],
});

describe("the QB->ACP-1 contingency + emergent recovery", () => {
  it("the stalled reply passes through FAIL_MISSING_ACK on the BAD link", () => {
    // Scan seeds for at least one run where the reply visibly hits MISSING_ACK.
    let sawMissingAck = false;
    for (let seed = 1; seed <= 30 && !sawMissingAck; seed++) {
      const s = run({ seed, actions: armOnly(), maxTicks: 20 });
      sawMissingAck = s.log.some((l) => /MISSING_ACK/.test(l.text));
    }
    expect(sawMissingAck).toBe(true);
  });

  it("doing nothing (FIFO) mostly loses — routine traffic starves the deadline reply", () => {
    expect(winRate(armOnly)).toBeLessThan(0.35);
  });

  it("re-prioritising the BAD link (EDF) substantially raises the win rate", () => {
    expect(winRate(edfAt(4))).toBeGreaterThan(winRate(armOnly) + 0.25);
  });

  it("rerouting via the DMS relay is a reliable recovery", () => {
    expect(winRate(rerouteAt(4))).toBeGreaterThan(0.85);
  });
});
