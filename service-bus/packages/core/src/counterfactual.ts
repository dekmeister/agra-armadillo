/**
 * Counterfactuals — "what the road not taken would have done, on this exact seed".
 *
 * The Phase 6 debrief's "on this seed, rerouting would have worked" line is the single
 * best teaching device in the game, and until WP5.4 it was the only one, hardcoded as a
 * string behind a `scenarioId === "phase6"` check.
 *
 * Phase 3 needs the same thing for a sharper reason: the player picks Static *or* Raft
 * and then never sees the other, so the level's actual subject — the cost/robustness
 * trade between two methods — is something they only ever experience one half of. The
 * debrief can close that by stating what the other method would have cost.
 *
 * These are COMPUTED, by replaying the level down the other branch, not written down.
 * The sim is deterministic and seeded, so the answer is exact; and because it is derived,
 * it cannot drift when someone retunes a scenario, which a hardcoded "Raft: 4 messages"
 * absolutely would.
 */
import { apply, createInitialState, tick } from "./engine.ts";
import type { ElectionMethod, GameState } from "./types.ts";

export interface ElectionOutcome {
  method: ElectionMethod;
  /** Election messages spent (request-vote + replies, or declarations). */
  messages: number;
  /** Tick a leader resolved, or null if the election stalled. */
  electedTick: number | null;
  /** Which node won, if any. */
  leader: string | null;
  /** True when the method never resolved — Raft without a reachable majority. */
  stalled: boolean;
}

/**
 * Replay a level, picking `method` at the first opportunity, and report what that method
 * cost. Pure: builds its own state from `(scenarioId, seed)` and touches nothing else.
 */
export function electionOutcome(
  scenarioId: string,
  seed: number,
  method: ElectionMethod,
  maxTicks = 40,
): ElectionOutcome {
  let s: GameState = createInitialState(seed, { scenarioId });
  let picked = false;
  let electedTick: number | null = null;

  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    // Take the decision the moment the level offers it, so the comparison is like for
    // like: both branches start from the same tick.
    if (!picked && s.pendingBeat?.id === "election-cost") {
      picked = true;
      s = apply(s, { type: "pickElection", method });
    }
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    if (electedTick === null && s.election?.leader) electedTick = s.tick;
  }

  return {
    method,
    messages: s.election?.msgCount ?? 0,
    electedTick,
    leader: s.election?.leader ?? null,
    stalled: electedTick === null,
  };
}

/**
 * The branch the player did NOT take, for a debrief line. Returns null when the level has
 * no such choice, so callers can render nothing rather than an empty comparison.
 */
export function electionCounterfactual(
  scenarioId: string,
  seed: number,
  taken: ElectionMethod,
): ElectionOutcome | null {
  const other: ElectionMethod = taken === "raft" ? "static" : "raft";
  const outcome = electionOutcome(scenarioId, seed, other);
  return outcome.messages === 0 && outcome.leader === null && !outcome.stalled ? null : outcome;
}
