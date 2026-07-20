/**
 * The campaign synthesis (WP5.5) — what the eight phases add up to.
 *
 * Phase 8 used to try to be this, in a decision beat that fired at T+1 and narrated the
 * landing round trip before it had happened. That was the wrong place twice over: the
 * synthesis was premature, and it was attached to a level rather than to the campaign.
 * The beat now comments on the landing it can actually see; the synthesis lives here and
 * renders in the WIN debrief of the final phase, which is the only moment at which the
 * player has done all of it.
 *
 * Deliberately organised by the two axes the campaign is built on — WHICH INTERFACE and
 * WHOSE AUTHORITY — rather than by phase number. Phase order is how it was taught; these
 * two are what was actually being taught.
 */

export interface SynthesisRow {
  /** Phase number, for the leading chip. */
  phase: number;
  /** The level's own name. */
  name: string;
  /** Which interfaces did the work, in the level's own terms. */
  interfaces: string;
  /** Who held authority, and over what. */
  authority: string;
  /** The one thing this phase existed to teach. */
  lesson: string;
}

export const SYNTHESIS: SynthesisRow[] = [
  {
    phase: 1,
    name: "Launch",
    interfaces: "C2 to the LRE; VI and MS on-platform",
    authority: "LRE — takeoff only",
    lesson:
      "An interaction is a round trip, and the on-platform lanes are free while the C2 one crosses the air.",
  },
  {
    phase: 2,
    name: "Hold",
    interfaces: "C2 status reports; VI on-platform",
    authority: "LRE — still narrow",
    lesson:
      "Tactical links fail in bursts, not coin flips, and FAIL_MISSING_ACK means sent-but-unconfirmed.",
  },
  {
    phase: 3,
    name: "Team formation",
    interfaces: "P2P — peer joins, then election traffic",
    authority: "None yet — that is the problem being solved",
    lesson: "Coordination costs messages, and the election method trades cost against robustness.",
  },
  {
    phase: 4,
    name: "Transit",
    interfaces: "P2P formation heartbeat vs an MP plan update",
    authority: "Leader relays; QB originates the plan",
    lesson: "When a capped link is contended, the queue discipline decides who gets the air.",
  },
  {
    phase: 5,
    name: "CAP",
    interfaces: "P2P COP fan-out vs MD sensor bulk",
    authority: "Leader owes every follower a fresh picture",
    lesson:
      "COP is one-to-many and freshness is per-recipient; shedding to protect it is triage, not a free win.",
  },
  {
    phase: 6,
    name: "Threat engagement",
    interfaces: "Gated C2 round trip; P2P COP underneath; MS relay",
    authority: "QB — and only the QB — for weapon release",
    lesson:
      "Arrival is not effect. Authority is checked at the destination, and a reachable node is not an authorised one.",
  },
  {
    phase: 7,
    name: "RTB at Bingo",
    interfaces: "C2 to the QB, then to the LRE; P2P re-election",
    authority: "Hands back QB → LRE",
    lesson:
      "Authority moves across a mission; a split package re-elects locally and merges only on command.",
  },
  {
    phase: 8,
    name: "Land",
    interfaces: "C2 to the LRE; VI flies the approach",
    authority: "LRE again — where it started",
    lesson:
      "The same message to a different authority means a different thing. That is the whole curriculum.",
  },
];

/**
 * The closing claim. Kept next to the table because it is the sentence the table exists
 * to earn — and because it is the one place the game states its thesis outright.
 */
export const SYNTHESIS_CLOSER =
  "One network carried all of it. What changed between phases was never the wire — it was " +
  "which interface the traffic belonged to, and who was standing at the far end with the " +
  "authority to act on it.";
