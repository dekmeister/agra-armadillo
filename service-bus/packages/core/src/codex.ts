/**
 * Message codex — one entry per real A-GRA message type the campaign uses.
 *
 * Lives in core (not the view) for two reasons: the drift test can then assert
 * against the sim's own `MessageType` union at compile time, and the Field Guide
 * renders this table rather than a hand-maintained copy of it, so the two cannot
 * disagree. See `test/codex.test.ts` for the guards.
 *
 * PROVENANCE. Every name below except `MA_SynchronizeGlobalCopToPeer` is confirmed
 * against `A-GRA_MessageDefinitions_v5_0_a.xsd` (the normative schema, in the sibling
 * brain-swap repo — see CLAUDE.md). That check is what caught the invented
 * `MA_VehicleCommandMT`, since renamed to the real `MA_FlightCommandMT`. Message
 * *names* being sourced does not mean their *sequences* are: the approval and
 * designation flows still need the C2 Volume, which is absent on this device.
 * Open items: `docs/VERIFY.md`.
 */

import type { InterfaceClass, MessageType } from "./types.ts";

/**
 * Whether the campaign actually puts this message on the wire, or merely declares
 * it. `declared-only` entries are honest seam-keeping — the guide says so rather
 * than implying the player will ever see one fly. The drift test enforces that an
 * `exercised` entry really is emitted by some level on its tutorial seed.
 */
export type CodexStatus = "exercised" | "declared-only";

/** Whether the name itself is confirmed against a primary A-GRA source. */
export type CodexProvenance =
  /** Present in A-GRA_MessageDefinitions_v5_0_a.xsd. */
  | "xsd"
  /** Our coinage or unconfirmed — carries an explanatory `caveat`. */
  | "unconfirmed";

export interface CodexEntry {
  /** Interface class the message rides. */
  cls: InterfaceClass;
  /** Endpoints, e.g. "C2 node -> MA" — topology, so it must be exact. */
  direction: string;
  /** One line: what this message does in the game. */
  role: string;
  /** Which levels emit it (empty for declared-only). */
  levels: number[];
  status: CodexStatus;
  provenance: CodexProvenance;
  /** Required when provenance is "unconfirmed"; a fidelity note otherwise. */
  caveat?: string;
}

/**
 * Typed as a total Record over `MessageType`, so adding a message to the union
 * without documenting it is a compile error. This is half the drift guard; the
 * other half (runtime) lives in the test.
 */
export const MESSAGE_CODEX: Record<MessageType, CodexEntry> = {
  MA_ApprovalRequestMT: {
    cls: "C2",
    direction: "MA -> QB (C2 node)",
    role: "Asks the Target Authority to approve a strike. The outbound leg of the weapon-employment gate — arriving is not approval.",
    levels: [6],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "Name is XSD-confirmed; the request->approve sequence and the Target-Authority gate are design-set assertions (VERIFY C4).",
  },
  MA_ApprovalRequestStatusMT: {
    cls: "C2",
    direction: "QB (C2 node) -> MA",
    role: "Carries APPROVED or REJECTED back. Losing this return leg to FAIL_MISSING_ACK is the campaign's central drama: the approval may exist and you cannot know.",
    levels: [6],
    status: "exercised",
    provenance: "xsd",
  },
  MA_RulesOfEngagementCommandMT: {
    cls: "C2",
    direction: "C2 node -> MA",
    role: "Routine ROE traffic. In the game it is the congestion that competes with the approval reply on a degraded link — the reason queue policy matters.",
    levels: [4, 6],
    status: "exercised",
    provenance: "xsd",
  },
  MA_CommTeamReportMT: {
    cls: "C2",
    direction: "MA -> C2 node (L2); MA -> MA (L5 bulk)",
    role: "Link-health / status report. L2 uses it for the report round trip that teaches FAIL_MISSING_ACK; L5 spawns it as deferrable bulk.",
    levels: [2, 5],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "L5 spawns this at class MD to stand in for deferrable bulk — see docs/01 item 17 on shared-air contention.",
  },
  MA_SynchronizeGlobalCopToPeer: {
    cls: "P2P",
    direction: "Leader MA -> peer MA",
    role: "One unit of COP fan-out from the leader to a follower. Keeping every follower's COP under the freshness threshold is L5's and L6's background pressure.",
    levels: [5, 6],
    status: "exercised",
    provenance: "unconfirmed",
    caveat:
      "[S] The only game message NOT found in the XSD, and it lacks the MT suffix every real type carries — the name is probably wrong. The real COP-sync message is defined in the Peer Volume, which is absent on this device (VERIFY P6). The topology it represents (leader fans COP out to peers over P2P) is sound.",
  },
  MA_TaskCommandMT: {
    cls: "C2",
    direction: "MA -> C2 node (LRE or QB)",
    role: "Command leg of a task round trip — takeoff (L1), RTB (L7), landing (L8). Authority is checked where it lands.",
    levels: [1, 7, 8],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "[S] docs/01 item 18: takeoff / landing / RTB share one command type. The authority topology is exact; the command semantics are abstracted.",
  },
  MA_TaskStatusMT: {
    cls: "C2",
    direction: "C2 node -> MA",
    role: "Status reply closing a task round trip. The task is not done when the request arrives — it is done when this returns.",
    levels: [1, 7, 8],
    status: "exercised",
    provenance: "xsd",
  },
  MA_TaskMT: {
    cls: "P2P",
    direction: "MA -> MA (intra-package)",
    role: "Formation/teaming task — the FollowFormation heartbeat that must keep flowing while sharing a capped link with routine C2 (L4's bandwidth lesson).",
    levels: [4],
    status: "exercised",
    provenance: "xsd",
  },
  MA_FlightCommandMT: {
    cls: "VI",
    direction: "MA -> FA (on-platform)",
    role: "The vehicle command — HSA_CSA or WaypointFollowing. Renders as the VI self-loop: it never crosses the air, costs no bandwidth and cannot burst-lose. That contrast is L1/L2's headline lesson.",
    levels: [1, 2],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "Was MA_VehicleCommandMT, a name that does not exist in A-GRA; renamed in WP3 after the XSD check. VI Volume Tables A-1-52/53/56 give the HSA_CSA, WaypointFollowing and Heading extensions.",
  },
  MA_LeaderUpdateRequestMT: {
    cls: "P2P",
    direction: "MA -> MA (intra-package)",
    role: "Leader-election payload — request-vote and declaration traffic. Raft spends two of these per peer and needs a quorum; Static spends one and declares locally.",
    levels: [3, 7],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "Name is XSD-confirmed; the five election methods and their cost profiles are design-set assertions (VERIFY P1, P2).",
  },
  MA_CommAvailableEndpointsMT: {
    cls: "P2P",
    direction: "MA -> MA (intra-package)",
    role: "Publish Network Endpoint Availability — peer-join / endpoint advertisement. The campaign models link health through the Inspector's quality bar instead, so this never flies.",
    levels: [],
    status: "declared-only",
    provenance: "xsd",
    caveat:
      "Declared to keep the seam honest (docs/01 L63): the game surfaces endpoint availability as a per-link readout rather than as messages.",
  },
};

/**
 * Lifecycle provenance — not a message the game sends, but the type whose
 * DestinationTransmissionStatus field defines PENDING / EXECUTING / FAIL_UNSENT /
 * FAIL_MISSING_ACK. Kept out of MESSAGE_CODEX (it would fail the "is it emitted?"
 * guard) but named here so the Field Guide and the copy-drift test can both refer
 * to it. See docs/01 item 21 for the [S] on our SENT.
 */
export const LIFECYCLE_SOURCE = "MA_TxDataPayloadCommandStatusMT" as const;

/**
 * Real A-GRA messages the campaign does NOT send, but the Field Guide is allowed to
 * name as reference — each with the reason it earns a mention. Kept as an explicit
 * allow-list rather than loosening the copy-drift guard: the point of that guard is
 * that naming a message in the UI must be a deliberate act.
 *
 * All XSD-confirmed. None of them may be described as something the player will see.
 */
export const REFERENCE_MESSAGE_NAMES: Record<string, string> = {
  MA_DesignationRequestMT:
    "The designation path of weapon employment — the second real gated flow, cited in the roles section alongside the approval path the game implements.",
  MA_DesignationMT:
    "The Target Authority's designation reply, completing the designation path. A candidate for a Phase 6 variant (PLAN_REVIEW WP7.2).",
  [LIFECYCLE_SOURCE]:
    "Defines the DMS lifecycle states via DestinationTransmissionStatus. Provenance, not traffic.",
};

/** Every name UI copy may legitimately mention. Used by the copy-drift test. */
export const KNOWN_MESSAGE_NAMES: readonly string[] = [
  ...Object.keys(MESSAGE_CODEX),
  ...Object.keys(REFERENCE_MESSAGE_NAMES),
];
