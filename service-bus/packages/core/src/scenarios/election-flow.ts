/**
 * Message-driven election flow shared by L3 (whole-package formation) and L7 (orphan
 * re-election after a partition). Drives the pure strategies in `election.ts` over the
 * real P2P links so votes can be lost/queued, and tallies them as they deliver.
 *
 * The election runs among a caller-supplied set of `participants` (the whole package in
 * L3, just the orphan half in L7). Installing the resolved leader is delegated to the
 * caller (`install`) because the *scope* of leadership differs: L3 has one leader across
 * the package; L7's orphan election must not unseat the leader on the far side.
 */
import { quorumOf, STRATEGIES } from "../election.ts";
import { spawn } from "../runtime.ts";
import type { ElectionMethod, GameState, Link, Message, NodeId, SimNode } from "../types.ts";

/** Mark the resolved leader (scope + COP seeding is the caller's concern). */
export type InstallLeader = (s: GameState, leaderId: NodeId) => void;

/** The directed link from `from` to `to`, if it exists. */
function linkBetween(s: GameState, from: NodeId, to: NodeId): Link | undefined {
  return Object.values(s.links).find((l) => l.from === from && l.to === to);
}

/** Emit one election message from->to and count it against the election budget. */
function emit(s: GameState, from: NodeId, to: NodeId, leg: Message["leg"]): void {
  const link = linkBetween(s, from, to);
  if (!link || !s.election) return;
  spawn(s, { type: "MA_LeaderUpdateRequestMT", cls: "P2P", route: [link.id], leg });
  s.election.msgCount += 1;
}

/** Kick off an election with `method` among `participants`. Sets `s.election`. */
export function startElection(
  s: GameState,
  method: ElectionMethod,
  participants: SimNode[],
  fitness: Record<NodeId, number>,
  install: InstallLeader,
): void {
  if (s.election) return; // one election at a time
  const strat = STRATEGIES[method];
  const candidate = strat.pickCandidate(participants, fitness);
  if (!candidate) return;

  s.election = {
    method,
    term: method === "raft" ? 1 : 0,
    candidateId: candidate,
    votes: [candidate], // the candidate votes for itself
    leader: null,
    msgCount: 0,
    quorum: quorumOf(participants.length),
    startTick: s.tick,
  };

  if (!strat.needsQuorum) {
    // Static: the fittest declares locally (no quorum), then announces to each peer.
    s.election.leader = candidate;
    install(s, candidate);
    for (const p of participants) if (p.id !== candidate) emit(s, candidate, p.id, "oneway");
    return;
  }
  // Raft: solicit a vote from every peer; leader resolves on a quorum of replies.
  for (const p of participants) if (p.id !== candidate) emit(s, candidate, p.id, "request");
}

/** Tally a delivered election message; resolve the leader on a Raft quorum. */
export function handleElectionDelivery(s: GameState, msg: Message, install: InstallLeader): void {
  if (msg.type !== "MA_LeaderUpdateRequestMT" || !s.election) return;
  const link = s.links[msg.route[msg.hop] ?? ""];
  if (!link) return;

  if (msg.leg === "request") {
    // A peer received the request-vote and grants it — reply to the candidate.
    emit(s, link.to, s.election.candidateId ?? link.from, "reply");
  } else if (msg.leg === "reply") {
    const voter = link.from;
    if (!s.election.votes.includes(voter)) s.election.votes.push(voter);
    if (
      s.election.votes.length >= s.election.quorum &&
      s.election.candidateId &&
      !s.election.leader
    ) {
      s.election.leader = s.election.candidateId;
      install(s, s.election.candidateId);
    }
  }
}
