// Core simulation types. Everything here is plain data — the sim core is
// deterministic and headless (CLAUDE.md hard rule #3): no RNG, no DOM, no wall-clock.
import type { MessagePayloads, MessageTypeName } from "./messages/index.ts";

/** The two parties on the (single, simplified) bus. Fidelity lie #1: FA collapses
 *  isolator + VMS + FA into one character. */
export type Party = "MA" | "FA";

export const MA_SYSTEM_ID = "MA";
export const FA_SYSTEM_ID = "FA";

/** What happened to a message when its recipient processed it. Mirrors the
 *  message-log disposition in docs/04 ("the message log is the debugger"). */
export type Disposition =
  | { kind: "delivered" }
  | { kind: "ignored-not-controller" }
  | { kind: "rejected"; reason: string };

export const DELIVERED: Disposition = { kind: "delivered" };
export const IGNORED_NOT_CONTROLLER: Disposition = { kind: "ignored-not-controller" };
export const rejected = (reason: string): Disposition => ({ kind: "rejected", reason });

/** A bus message. Payload is the pruned, catalog-shaped object for `type`. */
export interface Message<T extends MessageTypeName = MessageTypeName> {
  readonly type: T;
  readonly from: Party;
  readonly to: Party;
  readonly payload: MessagePayloads[T];
}

/** Helper to build a well-typed message without losing the payload's literal type. */
export function msg<T extends MessageTypeName>(
  type: T,
  from: Party,
  to: Party,
  payload: MessagePayloads[T],
): Message<T> {
  return { type, from, to, payload };
}

/** A message in flight: enqueued at `enqueuedTick`, delivered at `deliverAtTick`
 *  (= enqueuedTick + 1; single in-order bus, 1-tick delivery — fidelity lie #2). */
export interface QueuedMessage {
  readonly message: Message;
  readonly enqueuedTick: number;
  readonly deliverAtTick: number;
  readonly seq: number; // monotonic enqueue order, for stable FIFO delivery
}

/** One recorded bus delivery — the unit the message-log scrubber renders. */
export interface MessageLogEntry {
  readonly tick: number;
  readonly from: Party;
  readonly to: Party;
  readonly type: MessageTypeName;
  readonly payload: unknown;
  readonly disposition: Disposition;
}
