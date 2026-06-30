import { describe, expect, it } from "vitest";
import { adjudicateApproval, createInitialState, tick } from "../src/index.ts";
import type { GameState } from "../src/types.ts";
import { run } from "./helpers.ts";

function findByType(s: GameState, type: string) {
  return Object.values(s.messages).filter((m) => m.type === type);
}

describe("DMS lifecycle + round trip", () => {
  it("the approval request reaches SENT and the QB emits an APPROVED reply", () => {
    // Run far enough on a clean-ish seed for the request to deliver and adjudicate.
    let s = createInitialState(3, { config: { contingencyTick: 99 } });
    for (let t = 0; t < 8; t++) s = tick(s);

    const req = findByType(s, "MA_ApprovalRequestMT")[0];
    expect(req?.state).toBe("SENT");

    const reply = findByType(s, "MA_ApprovalRequestStatusMT")[0];
    expect(reply).toBeDefined();
    expect(reply?.approval).toBe("APPROVED");
    expect(reply?.authorityVerified).toBe(true);
  });

  it("adjudicateApproval encodes the Target-Authority gate (QB only)", () => {
    expect(adjudicateApproval("QB")).toBe("APPROVED");
    expect(adjudicateApproval("AVC")).toBe("REJECTED");
    expect(adjudicateApproval("LRE")).toBe("REJECTED");
    expect(adjudicateApproval("Observer")).toBe("REJECTED");
    expect(adjudicateApproval("Admin")).toBe("REJECTED");
  });

  it("a clean run with no contingency completes the strike (win)", () => {
    const s = run({
      seed: 5,
      scenario: { config: { contingencyTick: 99 } },
      actions: { 0: [{ type: "arm" }] },
    });
    expect(s.outcome).toBe("win");
  });
});
