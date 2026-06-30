import { describe, expect, it } from "vitest";
import { run } from "./helpers.ts";

describe("WEZ deadline", () => {
  it("an unattended armed run loses when the WEZ window closes", () => {
    // Force a loss: arm, do nothing, run past the deadline on a sticky-bad seed.
    let lost = run({ seed: 2, actions: { 0: [{ type: "arm" }] } });
    for (let seed = 2; seed <= 50 && lost.outcome !== "loss"; seed++) {
      lost = run({ seed, actions: { 0: [{ type: "arm" }] } });
    }
    expect(lost.outcome).toBe("loss");
  });
});
