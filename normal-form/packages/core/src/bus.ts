// The seeded bus: turns scheduled items into a deterministic, totally-ordered list
// of deliveries after applying a seed's disruption schedule. Pure and total: same
// items + same schedule ⇒ byte-identical deliveries, every run (determinism rule).
//
// The bus is generic over an opaque `payload` and keyed by an abstract `key` the
// seed ops target (WS-E). Both sim paths share it: the Command-2 path keys items by
// response state (`scheduleDeliveries` below), the one-way path keys them by
// publication link (`producer/`).
import type { CommandProcessingStateEnum } from "./messages/index.ts";
import type { Seed, SeedOp } from "./seeds.ts";

/** An item to schedule: an abstract `key` (what seed ops target) + a delivery
 *  `tick` + an opaque `payload` the caller recovers on the other side. */
export interface BusItem<P> {
  readonly key: string;
  readonly tick: number;
  readonly payload: P;
}

/** A scheduled item with a total order (`seq`) within the run. */
export interface BusDelivery<P> {
  readonly key: string;
  readonly tick: number;
  readonly seq: number;
  readonly duplicate: boolean;
  readonly payload: P;
}

interface Pending<P> {
  key: string;
  tick: number;
  duplicate: boolean;
  order: number; // stable tiebreak: authored order, duplicates after
  payload: P;
}

/** A pending matches a target key exactly, or by broadcast prefix: a bare send key
 *  `s0` names every `s0:<consumer>` link. (Command keys carry no `:`, so they only
 *  ever match exactly.) */
function matches(key: string, target: string): boolean {
  return key === target || key.startsWith(`${target}:`);
}

/** First non-duplicate pending matching `target` (the "real" item an op re-times). */
function findPrimary<P>(list: Pending<P>[], target: string): Pending<P> | undefined {
  return list.find((p) => !p.duplicate && matches(p.key, target));
}

function applyOp<P>(list: Pending<P>[], op: SeedOp, nextOrder: () => number): void {
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
        list.push({ ...orig, tick: orig.tick + op.delay, duplicate: true, order: nextOrder() });
      }
      return;
    }
    case "drop": {
      // Remove every pending the key names (a link, or a whole broadcast).
      for (let i = list.length - 1; i >= 0; i--) {
        if (matches(list[i]!.key, op.msg)) list.splice(i, 1);
      }
      return;
    }
  }
}

/** Apply a seed's schedule to `items` and produce the ordered delivery list. */
export function scheduleGeneric<P>(items: readonly BusItem<P>[], seed: Seed): BusDelivery<P>[] {
  let order = 0;
  const nextOrder = () => order++;
  const pending: Pending<P>[] = items.map((it) => ({
    key: it.key,
    tick: it.tick,
    duplicate: false,
    order: nextOrder(),
    payload: it.payload,
  }));

  for (const op of seed.schedule) applyOp(pending, op, nextOrder);

  // Total order: by delivery tick, then authored order (stable across runs).
  pending.sort((a, b) => a.tick - b.tick || a.order - b.order);
  return pending.map((p, i) => ({
    key: p.key,
    tick: p.tick,
    seq: i,
    duplicate: p.duplicate,
    payload: p.payload,
  }));
}

// ---------------------------------------------------------------------------
// Command-2 adapter (the response-status stream to the Commander).
// ---------------------------------------------------------------------------

/** SystemB generates a status of `state` for `commandId` at `emitTick`. A REJECTED
 *  status may carry a `reason` (a `CannotComplyEnum` value; sheet 1-3). */
export interface Emission {
  readonly state: CommandProcessingStateEnum;
  readonly commandId: string;
  readonly emitTick: number;
  readonly reason?: string;
}

/** A concrete status delivery to the Commander, with a total order (`seq`). */
export interface Delivery {
  readonly state: CommandProcessingStateEnum;
  readonly commandId: string;
  readonly tick: number;
  readonly seq: number;
  readonly duplicate: boolean;
  readonly reason?: string;
}

interface CommandPayload {
  readonly state: CommandProcessingStateEnum;
  readonly commandId: string;
  readonly reason?: string;
}

/** Apply a seed's schedule to status emissions and produce the ordered deliveries.
 *  Keys are the response states, so `reorder(RECEIVED, ACCEPTED)` etc. name them. */
export function scheduleDeliveries(emissions: readonly Emission[], seed: Seed): Delivery[] {
  const delivered = scheduleGeneric<CommandPayload>(
    emissions.map((e) => ({
      key: e.state,
      tick: e.emitTick,
      payload: { state: e.state, commandId: e.commandId, reason: e.reason },
    })),
    seed,
  );
  return delivered.map((d) => ({
    state: d.payload.state,
    commandId: d.payload.commandId,
    tick: d.tick,
    seq: d.seq,
    duplicate: d.duplicate,
    ...(d.payload.reason !== undefined ? { reason: d.payload.reason } : {}),
  }));
}
