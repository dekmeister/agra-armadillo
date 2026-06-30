/**
 * Domain types for the Service Bus simulation core.
 *
 * Identifiers use the real A-GRA / ASK 5.0a vocabulary wherever practical (the
 * non-negotiable topology guard rail in CLAUDE.md). Simplifications are marked
 * `[S]` here and mirrored in docs/01-mechanics-to-agra-mapping.md.
 */

/**
 * The six L1 interface classes of the A-GRA Mission Autonomy (MA).
 * MVP exercises C2 + P2P only; the rest are reserved so the seam stays honest.
 * Only C2, P2P, and MS/DMS updates cross the contested air — VI and local
 * sensor reads are on-platform and reliable (topology guard rail).
 */
export type InterfaceClass = "C2" | "P2P" | "VI" | "MS" | "MP" | "MD";

/**
 * DMS message lifecycle — verbatim from MA_TxDataPayloadCommandStatusMT.
 * PENDING (in queue, cancel/update legal) -> EXECUTING (left queue, in flight) ->
 * SENT (delivered + confirmed) | FAIL_UNSENT (lost before leaving queue, cheap
 * retry) | FAIL_MISSING_ACK (left, no delivery confirmation — the insidious one,
 * core drama on a return leg).
 */
export type Lifecycle = "PENDING" | "EXECUTING" | "SENT" | "FAIL_UNSENT" | "FAIL_MISSING_ACK";

/** Five A-GRA RBAC roles. Authority is checked at the destination (arrival != effect). */
export type Role = "Admin" | "QB" | "AVC" | "LRE" | "Observer";

/** Real A-GRA message types used in the MVP slice. */
export type MessageType =
  | "MA_ApprovalRequestMT" // strike approval request (C2)
  | "MA_ApprovalRequestStatusMT" // approval status reply (C2): APPROVED / REJECTED
  | "MA_RulesOfEngagementCommandMT" // routine C2 background traffic
  | "MA_CommTeamReportMT" // link-health report (C2)
  | "MA_SynchronizeGlobalCopToPeer"; // [S] COP fan-out unit (P2P)

/** Approval status carried by MA_ApprovalRequestStatusMT. CannotComply == REJECTED. */
export type ApprovalStatus = "APPROVED" | "REJECTED";

/** Player-configurable per-link queue discipline (docs/03). */
export type QueuePolicy = "fifo" | "edf" | "class";

/** Gilbert–Elliott two-state burst-loss channel state. */
export type Channel = "GOOD" | "BAD";

export type NodeId = string;
export type LinkId = string;
export type MsgId = string;
export type IxnId = string;

export interface SimNode {
  id: NodeId;
  kind: "QB" | "ACP";
  /** RBAC role this node declares via the Authorize sequence. */
  role: Role;
  isLeader: boolean;
  label: string;
}

/**
 * A directed link (A->B != B->A). Carries one interface class for rendering/backlog
 * purposes, but the queue may hold several message subtypes of that class.
 */
export interface Link {
  id: LinkId;
  from: NodeId;
  to: NodeId;
  cls: InterfaceClass;
  /** Messages dispatched (attempted) per tick. */
  bandwidthCap: number;
  /** Ticks in flight before arrival is resolved. */
  latency: number;
  /** Gilbert–Elliott channel state + transition probabilities (burstiness). */
  channel: Channel;
  pGoodToBad: number;
  pBadToGood: number;
  /** Probability a dispatch can't get on the air this tick (-> FAIL_UNSENT), per channel. */
  blockGood: number;
  blockBad: number;
  /** Probability a message that left is never confirmed (-> FAIL_MISSING_ACK). */
  ackLoss: number;
  /** Player-controlled queue discipline. */
  policy: QueuePolicy;
  /** Ids of messages currently queued (PENDING) on this link's current hop. */
  queue: MsgId[];
}

export interface Message {
  id: MsgId;
  type: MessageType;
  cls: InterfaceClass;
  /** Owning interaction, if part of a request/reply round trip. */
  ixn: IxnId | null;
  /** Whether this is the request or the reply leg of its interaction. */
  leg: "request" | "reply" | "oneway";
  state: Lifecycle;
  /** Ordered links the message traverses (supports relay reroute). */
  route: LinkId[];
  /** Current hop index into `route`. */
  hop: number;
  /** Enqueue sequence number (FIFO tiebreak). */
  seq: number;
  /** Higher = more important (class policy). */
  priority: number;
  /** Absolute tick by which this message must be SENT, or null. */
  deadlineTick: number | null;
  /** Approval status for MA_ApprovalRequestStatusMT replies. */
  approval: ApprovalStatus | null;
  /** Set true once authority was verified at the destination (QB-signed). */
  authorityVerified: boolean;
}

export interface InFlight {
  msg: MsgId;
  link: LinkId;
  arrivalTick: number;
}

/**
 * An interaction = a request + its required status reply (a round trip), the unit
 * A-GRA compliance is assessed at. The strike approval is the headline interaction.
 */
export interface Interaction {
  id: IxnId;
  kind: "strike-approval";
  request: MsgId;
  reply: MsgId | null;
  status: "open" | "approved" | "rejected" | "delivered" | "failed";
}

export type Objective = "stalled" | "in_progress" | "complete" | "missed";
export type Outcome = "pending" | "win" | "loss";

/**
 * A decision point — one self-contained A-GRA lesson surfaced when its triggering
 * state transition first fires. The view auto-pauses the clock on a `pendingBeat`
 * so the player can read the board and act; the pure core merely flags it (no DOM,
 * no wall-clock). Each beat id raises at most once per run (`seenBeats`).
 */
export type BeatId = "link-degraded" | "queue-starved" | "missing-ack" | "cop-warning";

export interface Beat {
  id: BeatId;
  /** Tick at which the beat was raised. */
  tick: number;
  /** Real A-GRA framing of what just happened. */
  title: string;
  /** One short sentence for the panel (the "More info" modal shows the full `concept`). */
  summary: string;
  /** The single concept this beat teaches. */
  concept: string;
  /** What to highlight on the board so the player's eye lands on the right thing. */
  focus: { kind: "node" | "link" | "token"; id: string };
  /** Player affordances to surface as buttons (subset of Action types). */
  actions: Action["type"][];
}

export interface LogEntry {
  tick: number;
  text: string;
  severity: "info" | "degrade" | "success" | "fail";
}

/** Player actions the engine applies purely (no UI/selection state here). */
export type Action =
  | { type: "arm" }
  | { type: "setPolicy"; linkId: LinkId; policy: QueuePolicy }
  | { type: "reroute" } // reroute the stalled approval reply QB -> ACP-2 -> ACP-1 via ACP-2's DMS
  | { type: "rerequest" } // re-issue the approval request (fresh interaction)
  | { type: "refreshCop" } // push a COP refresh over P2P
  | { type: "acknowledgeBeat" }; // dismiss the current decision point (view resumes the clock)

export interface GameState {
  tick: number;
  rngState: number;
  nodes: Record<NodeId, SimNode>;
  links: Record<LinkId, Link>;
  messages: Record<MsgId, Message>;
  interactions: Record<IxnId, Interaction>;
  inFlight: InFlight[];
  /** [S] COP collapsed to a single freshness scalar (0..100). */
  cop: number;
  copThreshold: number;
  copBreached: boolean;
  /** Absolute tick the WEZ window closes; null until armed. */
  wezDeadlineTick: number | null;
  armed: boolean;
  objective: Objective;
  outcome: Outcome;
  failReason: string | null;
  /** The decision point awaiting the player, or null. Set by the core, paused on by the view. */
  pendingBeat: Beat | null;
  /** Beat ids already raised this run, so each fires at most once. */
  seenBeats: BeatId[];
  log: LogEntry[];
  /** Monotonic counter for message ids/seq. */
  nextSeq: number;
  config: ScenarioConfig;
}

/** Static, scenario-level tunables (kept in state for reference + replay). */
export interface ScenarioConfig {
  seed: number;
  /**
   * tutorial = a curated seed where correct play deterministically wins (the
   * lesson always lands); challenge = honest Gilbert-Elliott luck. Recorded for
   * reference/replay; the view selects the seed by mode. v1 wires tutorial only.
   */
  mode: "tutorial" | "challenge";
  /** WEZ window length in ticks (seconds) once armed. */
  wezWindow: number;
  /** Tick at which the QB->ACP-1 return link is scripted BAD. */
  contingencyTick: number;
  /** COP decay per tick and the breach threshold. */
  copDecay: number;
  copStart: number;
  copThreshold: number;
  /** How often (ticks) the leader emits a COP fan-out cycle. */
  copSyncPeriod: number;
  /** Background C2 traffic injected on the QB->ACP-1 link per cycle. */
  bgC2Period: number;
}
