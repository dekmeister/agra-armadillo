// In-order message bus: a message enqueued at tick T is delivered at tick T+1
// (single bus, 1-tick delivery — fidelity lie #2). Pure data + pure helpers so the
// sim stays deterministic: same enqueue order ⇒ same delivery order, every run.
import type { Message, QueuedMessage } from "./types.ts";

export interface BusState {
  readonly queue: readonly QueuedMessage[];
  readonly nextSeq: number;
}

export function emptyBus(): BusState {
  return { queue: [], nextSeq: 0 };
}

/** Enqueue a message at `currentTick`; it becomes deliverable at `currentTick + 1`. */
export function enqueue(bus: BusState, message: Message, currentTick: number): BusState {
  const queued: QueuedMessage = {
    message,
    enqueuedTick: currentTick,
    deliverAtTick: currentTick + 1,
    seq: bus.nextSeq,
  };
  return { queue: [...bus.queue, queued], nextSeq: bus.nextSeq + 1 };
}

/** Enqueue several messages in order, preserving FIFO sequence. */
export function enqueueAll(
  bus: BusState,
  messages: readonly Message[],
  currentTick: number,
): BusState {
  let next = bus;
  for (const m of messages) next = enqueue(next, m, currentTick);
  return next;
}

/**
 * Split out messages due at `tick` (FIFO by enqueue order), leaving the rest queued.
 * Anything with deliverAtTick <= tick is considered due (defensive; normally == tick).
 */
export function takeDue(bus: BusState, tick: number): { due: QueuedMessage[]; bus: BusState } {
  const due: QueuedMessage[] = [];
  const remaining: QueuedMessage[] = [];
  for (const q of bus.queue) {
    if (q.deliverAtTick <= tick) due.push(q);
    else remaining.push(q);
  }
  due.sort((a, b) => a.seq - b.seq);
  return { due, bus: { queue: remaining, nextSeq: bus.nextSeq } };
}
