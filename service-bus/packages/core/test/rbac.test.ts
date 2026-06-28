import { describe, expect, it } from "vitest";
import { run } from "./helpers.ts";

describe("RBAC — arrival != authority", () => {
  it("a request that reaches a non-authority (AVC) is REJECTED and the strike fails", () => {
    // qbRole=AVC models the request being routed to a non-Target-Authority node.
    const s = run({
      seed: 11,
      scenario: { qbRole: "AVC", config: { contingencyTick: 99 } },
      actions: { 0: [{ type: "arm" }] },
    });
    expect(s.outcome).toBe("loss");
    expect(s.failReason).toMatch(/REJECTED|authority/i);

    const reply = Object.values(s.messages).find((m) => m.type === "MA_ApprovalRequestStatusMT");
    expect(reply?.approval).toBe("REJECTED");
    expect(reply?.authorityVerified).toBe(false);
  });

  it("the same request to the QB is APPROVED (control)", () => {
    const s = run({
      seed: 11,
      scenario: { config: { contingencyTick: 99 } },
      actions: { 0: [{ type: "arm" }] },
    });
    expect(s.outcome).toBe("win");
  });
});
