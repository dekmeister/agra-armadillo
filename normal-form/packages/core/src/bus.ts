// The seeded bus: turns a requestee's status *emissions* into a deterministic
// ordered list of *deliveries* to the Commander, after applying a seed's
// disruption schedule. Pure and total: same emissions + same schedule ⇒
// byte-identical deliveries, every run (determinism rule).
import type { CommandProcessingStateEnum } from "./messages/index.ts";
import type { Seed, SeedOp } from "./seeds.ts";

/** SystemB generates a status of `state` for `commandId` at `emitTick`. */
export interface Emission {
  readonly state: CommandProcessingStateEnum;
  readonly commandId: string;
  readonly emitTick: number;
}

/** A concrete delivery to the Commander, with a total order (`seq`) within the run. */
export interface Delivery {
  readonly state: CommandProcessingStateEnum;
  readonly commandId: string;
  readonly tick: number;
  readonly seq: number;
  readonly duplicate: boolean;
}

interface Pending {
  state: CommandProcessingStateEnum;
  commandId: string;
  tick: number;
  duplicate: boolean;
  order: number; // stable tiebreak: authored emission order, duplicates after
}

/** First non-duplicate pending for `state` (the "real" delivery an op targets). */
function findPrimary(list: Pending[], state: CommandProcessingStateEnum): Pending | undefined {
  return list.find((p) => p.state === state && !p.duplicate);
}

function applyOp(list: Pending[], op: SeedOp, nextOrder: () => number): void {
  switch (op.op) {
    case "reorder": {
      // Deliver `after` before `before`: push `before` to just after `after`'s slot.
      // (Causality: a status cannot arrive before it is emitted, so we delay the
      // earlier message rather than time-travel the later one.)
      const before = findPrimary(list, op.before);
      const after = findPrimary(list, op.after);
      if (before && after) before.tick = Math.max(before.tick, after.tick + 1);
      return;
    }
    case "delay": {
      const target = findPrimary(list, op.msg);
      if (target) target.tick += op.by;
      return;
    }
    case "dup": {
      const orig = findPrimary(list, op.msg);
      if (orig) {
        list.push({
          state: orig.state,
          commandId: orig.commandId,
          tick: orig.tick + op.delay,
          duplicate: true,
          order: nextOrder(),
        });
      }
      return;
    }
  }
}

/** Apply a seed's schedule to emissions and produce the ordered delivery list. */
export function scheduleDeliveries(emissions: readonly Emission[], seed: Seed): Delivery[] {
  let order = 0;
  const nextOrder = () => order++;
  const pending: Pending[] = emissions.map((e) => ({
    state: e.state,
    commandId: e.commandId,
    tick: e.emitTick,
    duplicate: false,
    order: nextOrder(),
  }));

  for (const op of seed.schedule) applyOp(pending, op, nextOrder);

  // Total order: by delivery tick, then authored order (stable across runs).
  pending.sort((a, b) => a.tick - b.tick || a.order - b.order);
  return pending.map((p, i) => ({
    state: p.state,
    commandId: p.commandId,
    tick: p.tick,
    seq: i,
    duplicate: p.duplicate,
  }));
}
