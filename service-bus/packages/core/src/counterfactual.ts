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
import { TAUGHT_PATHS } from "./replay.ts";
import { getScenario } from "./scenario.ts";
import type { ElectionMethod, GameState, PlayerMove } from "./types.ts";

/**
 * What the level's taught path does on this exact seed (WP6.2).
 *
 * Two different questions live in this module, and they must not be confused:
 *  - `taughtPathOutcome` answers "what would have WON" — shown on a loss.
 *  - `electionOutcome` / `electionCounterfactual` answer "what the other equally valid
 *    choice would have COST" — shown on wins too, because it is a comparison rather than
 *    a consolation.
 */
export interface TaughtOutcome {
  /** Whether the taught path actually wins on this seed. */
  won: boolean;
  /** Tick the run resolved. */
  tick: number;
  /** The moves the taught path made, already phrased by `describeAction`. */
  moves: PlayerMove[];
}

/**
 * Replay a level down its taught path and report what happens.
 *
 * Phase 6's debrief used to assert, as a hardcoded string on every loss, that "rerouting at
 * the MISSING_ACK point delivers the reply in time" — without ever checking whether that
 * was true of the run in front of the player. Replaying it makes the claim earned rather
 * than asserted, and generalises the game's single best teaching device to every level that
 * has a taught path.
 *
 * Returns `null` for levels with no taught path (Phases 1 and 8 are near-unloseable, and
 * inventing a counterfactual for a level you cannot lose would be teaching a fiction).
 * Callers must honour `won: false` by rendering nothing — never state a counterfactual the
 * sim did not produce.
 */
export function taughtPathOutcome(
  scenarioId: string,
  seed: number,
  maxTicks = 60,
): TaughtOutcome | null {
  const taught = TAUGHT_PATHS[scenarioId];
  if (!taught) return null;
  const choose = taught();

  let s: GameState = createInitialState(seed, { scenarioId });
  s = apply(s, { type: "arm" });
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    const a = choose(s);
    if (a) s = apply(s, a);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
  }
  return { won: s.outcome === "win", tick: s.tick, moves: s.playerMoves };
}

/** Every level that can state a counterfactual — used by the honesty guard in tests. */
export function levelsWithTaughtPath(): string[] {
  return Object.keys(TAUGHT_PATHS).filter((id) => getScenario(id).id === id);
}

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
