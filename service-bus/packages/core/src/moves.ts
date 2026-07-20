/**
 * Human-readable phrasing for player actions (WP6.3).
 *
 * The debrief used to name the player's moves by regexing the event log for fragments of
 * the prose each scenario happened to write. That coupling failed in three ways at once:
 * it matched the engine's own automatic "Re-attempting." line in Phase 6 (so a run where
 * the player did nothing still listed a move), it missed `requestVia` because that path
 * logs "re-addressed" rather than "re-requested", and it missed `pickElection` and
 * `resumeTraffic` entirely because neither writes a log line at all.
 *
 * So the phrasing lives here instead, derived from the `Action` payload alone. Two callers
 * share it — the debrief's "Your moves" list and the counterfactual harness's "on this
 * seed, <this> wins" sentence — which is the point: the taught path and the player's own
 * record describe the same action the same way.
 *
 * Deliberately holds NO scenario knowledge. Node ids resolve to their board labels when a
 * state is supplied, but nothing here reaches into level copy, so retuning a level cannot
 * make these strings wrong.
 */
import type { Action, GameState } from "./types.ts";

/** Board label for a node id, falling back to the raw id when no state is to hand. */
function nodeLabel(id: string, s?: GameState): string {
  return s?.nodes[id]?.label ?? id.toUpperCase();
}

/**
 * Render one action as a past-tense phrase for a retrospective ("Rerouted the reply …").
 * Total over the `Action` union — a new variant is a type error here, which is the guard
 * that keeps the debrief from silently dropping a newly added affordance.
 */
export function describeAction(action: Action, s?: GameState): string {
  switch (action.type) {
    case "arm":
      return "Armed the mission clock";
    case "setPolicy":
      return `Set ${action.linkId} queue policy to ${action.policy.toUpperCase()}`;
    case "reroute":
      return "Rerouted the stalled reply via the relay platform's DMS";
    case "rerequest":
      return "Re-issued the approval request on the same link";
    case "requestVia":
      return `Re-addressed the approval request to ${nodeLabel(action.nodeId, s)}`;
    case "refreshCop":
      return "Pushed a COP refresh over P2P";
    case "retry":
      return "Re-attempted the unconfirmed status reports";
    case "pickElection":
      return `Elected a leader by ${action.method === "raft" ? "Raft" : "Static Fitness Score"}`;
    case "shedTraffic":
      return "Shed low-priority sensor bulk to protect the COP fan-out";
    case "resumeTraffic":
      return "Restored the shed sensor bulk";
    case "handBack":
      return "Handed authority back QB → LRE";
    case "mergeTeam":
      return "Merged the split package on command";
    case "acknowledgeBeat":
      return "Acknowledged a decision point";
  }
}

/**
 * Record an action that actually took effect. `arm` and `acknowledgeBeat` are excluded by
 * the caller: neither is a teaching decision, and listing them would bury the real moves.
 */
export function recordMove(s: GameState, action: Action): void {
  s.playerMoves.push({ tick: s.tick, action, label: describeAction(action, s) });
}
