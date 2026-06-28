/**
 * Message + interaction helpers and the DMS lifecycle transitions.
 *
 * A Message is one leg (request or reply) of an Interaction. Cargo = interactions
 * (a request + its required status reply), the unit A-GRA compliance is assessed
 * at; the return leg can fail independently (FAIL_MISSING_ACK).
 */
import type { GameState, Lifecycle, Message, MsgId } from "./types.ts";

/** Build a message id. Deterministic given the monotonic seq counter. */
export function makeMsgId(prefix: string, seq: number): MsgId {
  return `${prefix}-${seq}`;
}

/** Enqueue a message onto the first link of its route (PENDING). */
export function enqueue(state: GameState, msg: Message): void {
  state.messages[msg.id] = msg;
  msg.state = "PENDING";
  msg.hop = 0;
  const linkId = msg.route[msg.hop];
  if (linkId) state.links[linkId]?.queue.push(msg.id);
}

/** Is this a terminal lifecycle state (no further transitions)? */
export function isTerminal(state: Lifecycle): boolean {
  return state === "SENT" || state === "FAIL_UNSENT" || state === "FAIL_MISSING_ACK";
}

/** Remove a message id from a link queue (used on cancel / reroute). */
export function dequeue(state: GameState, msgId: MsgId, linkId: string): void {
  const link = state.links[linkId];
  if (!link) return;
  const i = link.queue.indexOf(msgId);
  if (i >= 0) link.queue.splice(i, 1);
}
