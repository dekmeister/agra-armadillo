import { describe, expect, it } from "vitest";
import { createInitialState, tick } from "../src/index.ts";
import { run } from "./helpers.ts";

describe("determinism", () => {
  it("same (scenario, seed) yields byte-identical runs", () => {
    const a = run({ seed: 42, actions: { 0: [{ type: "arm" }] } });
    const b = run({ seed: 42, actions: { 0: [{ type: "arm" }] } });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("different seeds diverge", () => {
    const a = run({ seed: 1, actions: { 0: [{ type: "arm" }] }, maxTicks: 25 });
    const b = run({ seed: 999, actions: { 0: [{ type: "arm" }] }, maxTicks: 25 });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it("tick is a pure function — replaying the same state advances identically", () => {
    const s0 = createInitialState(7);
    const onceA = tick(s0);
    const onceB = tick(s0);
    expect(JSON.stringify(onceA)).toEqual(JSON.stringify(onceB));
    // And s0 itself was not mutated.
    expect(s0.tick).toBe(0);
  });
});
