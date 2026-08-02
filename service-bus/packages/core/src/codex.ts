/**
 * Message codex — one entry per real A-GRA message type the campaign uses.
 *
 * Lives in core (not the view) for two reasons: the drift test can then assert
 * against the sim's own `MessageType` union at compile time, and the Field Guide
 * renders this table rather than a hand-maintained copy of it, so the two cannot
 * disagree. See `test/codex.test.ts` for the guards.
 *
 * Note the MS and MD entries carry no `MA_` prefix: subsystem-side messages in the
 * Mission Systems Volume are named without it, and inventing one to make the table look
 * uniform would be exactly the kind of plausible-looking fiction the guard rail forbids.
 *
 * PROVENANCE. Every `MA_*` / subsystem name below is confirmed against
 * `A-GRA_MessageDefinitions_v5_0_a.xsd` (the normative schema, in the sibling
 * brain-swap repo — see CLAUDE.md). That check is what caught the invented
 * `MA_VehicleCommandMT`, since renamed to the real `MA_FlightCommandMT`.
 *
 * Exactly one entry, `GAME_CopSyncToPeer`, has no A-GRA counterpart, and its prefix says
 * so at every call site. It was previously `MA_SynchronizeGlobalCopToPeer` — a name that
 * looked A-GRA-shaped, was absent from the XSD, and even lacked the `MT` suffix every real
 * type carries. Renaming rather than re-caveating it is the guard rail applied honestly:
 * an `MA_` prefix is a provenance claim.
 *
 * Message *names* being sourced does not mean their *sequences* are, though the XSD's
 * ROE annotations do source the designation flow and the Target-Authority gate. What
 * still needs the absent C2 Volume is the RBAC role set. Open items: `docs/VERIFY.md`.
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
    levels: [6],
    status: "exercised",
    provenance: "xsd",
  },
  MA_CommTeamReportMT: {
    cls: "C2",
    direction: "MA -> C2 node",
    role: "Link-health / status report. L2 uses it for the report round trip that teaches FAIL_MISSING_ACK.",
    levels: [2],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "Until WP5.2 L5 also spawned this at class MD to stand in for deferrable bulk — one message type flying as three different interface classes. L5 now uses the real ObservationMeasurementReportMT instead.",
  },
  GAME_CopSyncToPeer: {
    cls: "P2P",
    direction: "Leader MA -> peer MA",
    role: "One unit of COP fan-out from the leader to a follower. Keeping every follower's COP under the freshness threshold is L5's and L6's background pressure.",
    levels: [5, 6],
    status: "exercised",
    provenance: "unconfirmed",
    caveat:
      "[S] The one message here that is NOT an A-GRA type, which is why it carries a GAME_ prefix rather than an MA_ one. It was called MA_SynchronizeGlobalCopToPeer until this pass; that name was absent from the XSD and lacked the MT suffix every real type carries. There is nothing to rename it to: no A-GRA message carries COP content. MS Vol §1.2.3 shows the COP is aggregated from ordinary typed status messages (SubsystemStatusMT, MA_AMTI_CapabilityMT, PO_ActivityMT, weapon status), and the real MA_COP_ConfigurationSettings* messages configure the COP rather than carry it. So this is a double simplification — an invented message standing for an aggregate — and the fan-out topology it represents (leader fans COP out to peers over P2P) is the part that is sound. VERIFY P6.",
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
    role: "Formation/teaming task — the FollowFormation heartbeat that must keep reaching each follower while sharing a capped link with an MP mission-plan update (L4's bandwidth lesson).",
    levels: [4],
    status: "exercised",
    provenance: "xsd",
  },
  MA_FlightCommandMT: {
    cls: "VI",
    direction: "MA -> FA (on-platform)",
    role: "The vehicle command — HSA_CSA or WaypointFollowing. Renders as the VI self-loop: it never crosses the air, costs no bandwidth and cannot burst-lose. That contrast is L1/L2's headline lesson, and L8 flies the final approach with it.",
    levels: [1, 2, 8],
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
      "Name is XSD-confirmed, as are the four election methods themselves (enumerated 0-3 on MA_LeadershipMetricsMDT.PackageLeaderElectionMethod). Their cost profiles remain design-set assertions (VERIFY P2).",
  },
  MA_CommAvailableEndpointsMT: {
    cls: "P2P",
    direction: "MA -> MA (intra-package)",
    role: "Publish Network Endpoint Availability — peer-join / endpoint advertisement. L3 flies it as the package-joining traffic that forms the team before any leader exists to elect.",
    levels: [3],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "The game still surfaces ongoing link health as the Inspector's per-link quality readout rather than as a message stream; L3 uses this only for the initial join (docs/01 L63).",
  },

  // --- MS: the PNT service package (L1) -------------------------------------
  // MS Volume §1.2.7.1 "Request PNT Navigation Data" (~L2063-2085) gives this whole
  // four-message sequence verbatim; all four names are XSD-confirmed. It runs MA <->
  // *local* MS over the on-platform ASB, so like VI it is reliable and free.
  SubsystemStatusDataRequestMT: {
    cls: "MS",
    direction: "MA -> MS (on-platform)",
    role: "Step 1 of PNT init: MA asks the Mission Systems subsystem whether it can supply position at all, before relying on it.",
    levels: [1],
    status: "exercised",
    provenance: "xsd",
  },
  SubsystemStatusDataRequestStatusMT: {
    cls: "MS",
    direction: "MS -> MA (on-platform)",
    role: "Step 2: the MS reports its own health and status back. The request is not answered until this returns — the same round-trip rule as every C2 command.",
    levels: [1],
    status: "exercised",
    provenance: "xsd",
  },
  SubsystemSettingsCommandMT: {
    cls: "MS",
    direction: "MA -> MS (on-platform)",
    role: "Step 3: MA commands the PNT service how often to publish. Configuration, not a data request — the subscription model in miniature.",
    levels: [1],
    status: "exercised",
    provenance: "xsd",
  },
  MA_PositionReportDetailedMT: {
    cls: "MS",
    direction: "MS -> MA (on-platform)",
    role: "Step 4 and the product: detailed ACP position, published at the commanded rate. The free on-platform loop that runs alongside the VI one in L1.",
    levels: [1],
    status: "exercised",
    provenance: "xsd",
  },

  // --- MD: sensor track distribution (L5) ------------------------------------
  ObservationMeasurementReportMT: {
    cls: "MD",
    direction: "MS -> MA, and MA -> MA across the package",
    role: "Raw sensor observations (OMRs) that local fusion builds tracks from. L5's deferrable bulk: shedding it protects the COP fan-out but decays your own track completeness — the trade that makes shedding triage rather than a free win.",
    levels: [5],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "MS Volume §1.2.4.1 (~L1350-1400) defines it and states that only a SUBSET of OMRs are associated with any given track, and that fused tracks then feed the COP — which is what makes it deferrable and what the cost model rests on.",
  },

  // --- MP: the mission-planning interface (L4) -------------------------------
  MA_MissionPlanCommandMT: {
    cls: "MP",
    direction: "C2 node -> MA -> MA (two hops, into and across the package)",
    role: "An OTA mission-plan update re-tasking a formation member. L4's competing traffic: important, but deadline-free, so it is exactly what should yield to a formation heartbeat.",
    levels: [4],
    status: "exercised",
    provenance: "xsd",
    caveat:
      "MP's one honest appearance in the campaign. Before WP5.1 no message anywhere was class MP; L5 faked it by spawning MA_CommTeamReportMT at that class.",
  },
  MA_MissionPlanCommandStatusMT: {
    cls: "MP",
    direction: "MA -> MA (back to the leader)",
    role: "The plan update's required status reply. Its arrival is what makes the plan push an interaction rather than a fire-and-forget push.",
    levels: [4],
    status: "exercised",
    provenance: "xsd",
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
