/**
 * Leader-election strategies (L3 Team Formation, reused for L7's orphan re-election).
 *
 * A-GRA names five methods (Bully / Maximum Consensus / Raft / Static Fitness Score /
 * Off-Nominal); the campaign ships **Raft + Static** (per MVP scope), each with a
 * distinct message-cost profile run over the same P2P links the package uses.
 *
 * This module is the pure strategy layer: cost model, candidate selection, and quorum
 * math. The *message flow* (emitting request-vote / declaration messages, tallying them
 * as they deliver, handling loss) lives in the scenario (`scenarios/phase3.ts`), which
 * owns the topology — election.ts stays link-agnostic.
 *
 * [S] Real Raft picks a candidate on a randomized election timeout; here the fittest
 *     node is a deterministic stand-in candidate. Static/Raft are the only two methods.
 */
import type { ElectionMethod, NodeId, SimNode } from "./types.ts";

export interface ElectionStrategy {
  method: ElectionMethod;
  /** Estimated election message count for `n` participating nodes (drives the cost beat). */
  messageCost(n: number): number;
  /** Raft needs a majority of votes to resolve; Static declares locally without one. */
  needsQuorum: boolean;
  /** The node that leads (Static: fittest) or solicits votes (Raft candidate: fittest stand-in). */
  pickCandidate(candidates: SimNode[], fitness: Record<NodeId, number>): NodeId | null;
}

/** Majority threshold for `n` participants: floor(n/2) + 1. */
export function quorumOf(n: number): number {
  return Math.floor(n / 2) + 1;
}

/** Highest-fitness candidate (ties broken by id for determinism). */
function fittest(candidates: SimNode[], fitness: Record<NodeId, number>): NodeId | null {
  let best: NodeId | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const c of [...candidates].sort((a, b) => a.id.localeCompare(b.id))) {
    const f = fitness[c.id] ?? 0;
    if (f > bestScore) {
      bestScore = f;
      best = c.id;
    }
  }
  return best;
}

/** Static Fitness Score: pre-loaded scores, the fittest declares locally. Cheap, no quorum. */
export const staticStrategy: ElectionStrategy = {
  method: "static",
  messageCost: (n) => n, // one declaration per node [S]
  needsQuorum: false,
  pickCandidate: fittest,
};

/** Raft: a candidate solicits a majority of votes over P2P; stalls without a quorum. */
export const raftStrategy: ElectionStrategy = {
  method: "raft",
  messageCost: (n) => 2 * n, // request-vote + reply per peer [S]
  needsQuorum: true,
  pickCandidate: fittest,
};

export const STRATEGIES: Record<ElectionMethod, ElectionStrategy> = {
  raft: raftStrategy,
  static: staticStrategy,
};
