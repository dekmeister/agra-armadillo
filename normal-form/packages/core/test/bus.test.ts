import { type Emission, type Seed, scheduleDeliveries } from "@normal-form/core";
import { describe, expect, it } from "vitest";

// RECEIVED emitted at +2, ACCEPTED at +4 (relative to a command received at t=1).
const emissions: readonly Emission[] = [
  { state: "RECEIVED", commandId: "cmd", emitTick: 3 },
  { state: "ACCEPTED", commandId: "cmd", emitTick: 5 },
];

const seed = (id: number, schedule: Seed["schedule"]): Seed => ({ id, label: `s${id}`, schedule });

describe("seeded bus", () => {
  it("in-order: deliveries mirror emissions", () => {
    const d = scheduleDeliveries(emissions, seed(1, []));
    expect(d.map((x) => [x.state, x.tick])).toEqual([
      ["RECEIVED", 3],
      ["ACCEPTED", 5],
    ]);
  });

  it("reorder delivers ACCEPTED before RECEIVED without time-travel", () => {
    const d = scheduleDeliveries(
      emissions,
      seed(2, [{ op: "reorder", before: "RECEIVED", after: "ACCEPTED" }]),
    );
    // ACCEPTED stays at its emission tick (5); RECEIVED is pushed to just after (6).
    expect(d.map((x) => [x.state, x.tick])).toEqual([
      ["ACCEPTED", 5],
      ["RECEIVED", 6],
    ]);
  });

  it("dup adds a duplicate delivery `delay` ticks later", () => {
    const d = scheduleDeliveries(emissions, seed(3, [{ op: "dup", msg: "ACCEPTED", delay: 2 }]));
    expect(d.map((x) => [x.state, x.tick, x.duplicate])).toEqual([
      ["RECEIVED", 3, false],
      ["ACCEPTED", 5, false],
      ["ACCEPTED", 7, true],
    ]);
  });

  it("assigns a stable total order (seq) and is byte-stable across runs", () => {
    const run = () =>
      JSON.stringify(
        scheduleDeliveries(emissions, seed(3, [{ op: "dup", msg: "ACCEPTED", delay: 2 }])),
      );
    expect(run()).toBe(run());
    const d = scheduleDeliveries(emissions, seed(3, [{ op: "dup", msg: "ACCEPTED", delay: 2 }]));
    expect(d.map((x) => x.seq)).toEqual([0, 1, 2]);
  });
});
