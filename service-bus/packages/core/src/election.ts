/**
 * Leader-election strategies.
 *
 * A-GRA defines five named methods (Bully / Maximum Consensus / Raft / Static
 * Fitness Score / Off-Nominal), each with a distinct message-cost profile run over
 * the same degraded links that caused the leadership loss. The MVP (OV-1 Phase 6)
 * has no team-split / re-election, so this module only fixes the seam: the strategy
 * interface plus Raft + Static stubs are wired but not load-bearing yet.
 *
 * [S] Election is not exercised in the Phase-6 MVP (see docs/01). Message-cost
 * models for the full roster land when Phase 3 (team formation) is built.
 */
import type { NodeId, SimNode } from "./types.ts";

export type ElectionMethod = "raft" | "static";

export interface ElectionStrategy {
  method: ElectionMethod;
  /** Estimated election message count for `n` participating nodes (for scoring later). */
  messageCost(n: number): number;
  /** Pick a leader from candidates. Static uses fitness; Raft uses lowest id as a stand-in. */
  electLeader(candidates: SimNode[], fitness: Record<NodeId, number>): NodeId | null;
}

/** Static Fitness Score: pre-loaded scores, highest declares. Very low cost, inflexible. */
export const staticStrategy: ElectionStrategy = {
  method: "static",
  messageCost: (n) => n, // one declaration per node [S]
  electLeader(candidates, fitness) {
    let best: NodeId | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const c of candidates) {
      const f = fitness[c.id] ?? 0;
      if (f > bestScore) {
        bestScore = f;
        best = c.id;
      }
    }
    return best;
  },
};

/** Raft: term + heartbeat + majority vote. Low steady cost, vote burst on timeout. */
export const raftStrategy: ElectionStrategy = {
  method: "raft",
  messageCost: (n) => 2 * n, // request-vote + reply per node [S]
  electLeader(candidates) {
    // [S] Stand-in: deterministic pick (lowest id). Real Raft needs quorum + terms.
    const ids = candidates.map((c) => c.id).sort();
    return ids[0] ?? null;
  },
};

export const STRATEGIES: Record<ElectionMethod, ElectionStrategy> = {
  raft: raftStrategy,
  static: staticStrategy,
};
