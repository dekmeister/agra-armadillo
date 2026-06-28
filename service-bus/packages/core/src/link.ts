/**
 * Directed RF link model (docs/03).
 *
 * Every link is a directed edge with four first-class, tunable properties:
 *  - bandwidth (hard cap on dispatch attempts per tick; excess stays queued),
 *  - latency (ticks in flight),
 *  - per-message loss probability p_loss (drives FAIL_UNSENT / FAIL_MISSING_ACK),
 *  - intermittency: a Gilbert–Elliott two-state (GOOD<->BAD) Markov chain, chosen
 *    over iid because tactical links fail in bursts.
 *
 * Queue discipline is player-configurable per link: fifo / edf / class.
 */
import type { Rng } from "./rng.ts";
import type { Link, Message, QueuePolicy } from "./types.ts";

/** Advance the Gilbert–Elliott channel one tick. Mutates and returns the link. */
export function stepChannel(link: Link, rng: Rng): Link {
  if (link.channel === "GOOD") {
    if (rng.chance(link.pGoodToBad)) link.channel = "BAD";
  } else {
    if (rng.chance(link.pBadToGood)) link.channel = "GOOD";
  }
  return link;
}

/** Probability a dispatch attempt can't get on the air this tick (-> FAIL_UNSENT). */
export function blockProb(link: Link): number {
  return link.channel === "BAD" ? link.blockBad : link.blockGood;
}

/**
 * Order the queued messages for dispatch under the link's policy.
 * Returns message ids in dispatch order (best first).
 */
export function dispatchOrder(link: Link, messages: Record<string, Message>): string[] {
  const cmp = comparator(link.policy);
  const present = link.queue.flatMap((id) => {
    const msg = messages[id];
    return msg ? [{ id, msg }] : [];
  });
  present.sort((a, b) => cmp(a.msg, b.msg));
  return present.map((p) => p.id);
}

function comparator(policy: QueuePolicy): (a: Message, b: Message) => number {
  switch (policy) {
    case "fifo":
      return (a, b) => a.seq - b.seq;
    case "edf":
      // Earliest deadline first; messages without a deadline sort last (by seq).
      return (a, b) => deadline(a) - deadline(b) || a.seq - b.seq;
    case "class":
      // Highest priority first, then oldest.
      return (a, b) => b.priority - a.priority || a.seq - b.seq;
  }
}

function deadline(m: Message): number {
  return m.deadlineTick ?? Number.POSITIVE_INFINITY;
}
