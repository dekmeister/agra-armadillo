/**
 * Field Guide content (WP3) — the game's technical-background layer.
 *
 * Structured data, not markup, wherever the content is tabular: the guide's job is
 * to be *checkable*, and a table of typed rows can be tested where a blob of HTML
 * cannot. Prose blocks are developer-authored HTML strings rendered via `{@html}`,
 * the same convention (and the same safety argument — static, no user input) as
 * `lib/help.ts`.
 *
 * The message codex is NOT duplicated here: it renders straight from
 * `MESSAGE_CODEX` in `@service-bus/core`, guarded by `packages/core/test/codex.test.ts`.
 *
 * PROVENANCE IS PART OF THE CONTENT. This project's guard rail is that the game
 * must never teach something false, and a chunk of what the design set asserts
 * cannot currently be checked: the C2 and Peer Interface Volumes are not on this
 * device (see CLAUDE.md). Rather than flatten that away, every claim carries a
 * `Provenance`, and the UI shows it. Open items are tracked in `docs/VERIFY.md`.
 */

/** Where a claim comes from. Rendered as a small chip next to the content. */
export type Provenance =
  /** Stated in an ASK 5.0a source available on this device (incl. the normative XSD). */
  | "ask"
  /** Asserted by this project's design set; the volume that would confirm it is absent. */
  | "assert"
  /** Our inference from available sources — reasonable, but not stated anywhere. */
  | "inferred"
  /** Sourced from outside A-GRA entirely (e.g. OMG for DDS). */
  | "external";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  ask: "ASK 5.0a",
  assert: "design set — unverified",
  inferred: "inferred",
  external: "non-A-GRA source",
};

export const PROVENANCE_TITLE: Record<Provenance, string> = {
  ask: "Stated in an ASK 5.0a source available to this build.",
  assert:
    "Asserted by this project's design set. The Interface Volume that would confirm it is not available on this device — see docs/VERIFY.md.",
  inferred: "Not stated in any available source; inferred from what is. Treat with care.",
  external: "Comes from outside A-GRA (e.g. the OMG DDS specification).",
};

export interface GuideSection {
  id: string;
  title: string;
  /** One line under the heading — what this section answers. */
  standfirst: string;
}

export const SECTIONS: GuideSection[] = [
  {
    id: "architecture",
    title: "The architecture",
    standfirst: "What A-GRA is, and the two buses this game keeps distinct.",
  },
  {
    id: "interfaces",
    title: "The six L1 interfaces",
    standfirst: "What flows where — and which of them cross the contested air.",
  },
  {
    id: "lifecycle",
    title: "The DMS message lifecycle",
    standfirst: "How a message succeeds, fails, or leaves you unsure.",
  },
  {
    id: "roles",
    title: "Roles & authority",
    standfirst: "Who may command what, and why arrival is not effect.",
  },
  {
    id: "election",
    title: "Leader election",
    standfirst: "Four named methods, and what each costs in messages.",
  },
  {
    id: "codex",
    title: "Message codex",
    standfirst: "Every A-GRA message this game uses, and what it does here.",
  },
  { id: "glossary", title: "Glossary", standfirst: "Every acronym the game puts on screen." },
  {
    id: "fidelity",
    title: "Fidelity notes",
    standfirst: "What the game simplifies, and what it costs.",
  },
];

/* ------------------------------------------------------------------ §1 */

export const ARCHITECTURE_HTML = `
<p><b>A-GRA</b> (Autonomy Government Reference Architecture) is a reference architecture for
  collaborative military autonomy — this game is built on <b>ASK 5.0a</b>, which builds on
  <b>UCI 2.5</b>. It defines the software on an autonomous platform, called <b>Mission Autonomy
  (MA)</b>, and the interfaces MA presents to everything else. Those external interfaces are its
  <b>Level 1 (L1)</b> interfaces; there are six of them, and they are the subject of this game.</p>
<p>Service Bus does not model what is <i>inside</i> a message. It models the <b>topology and
  message-flow layer</b>: who talks to whom, over which interface, gated by what, under what link
  conditions. Every message here is part of an <b>interaction</b> — a request plus its required
  status reply, a round trip. That round trip is the unit A-GRA compliance is assessed at, and
  <b>its return leg can fail on its own</b>. Most of this game's drama lives in that fact.</p>
<h4>ASB vs DMS — two different buses</h4>
<p>The <b>Abstract Service Bus (ASB)</b> is <b>on-platform</b>: the bus between a platform's MA and
  its local Mission Systems. It is reliable and never touches the air.</p>
<p>The <b>Decentralized Messaging Service (DMS)</b> carries traffic <b>off</b> the platform. Every
  platform runs its <b>own</b> DMS instance, and those instances form a <b>DDS/RTPS pub-sub
  mesh</b>. There is no central broker to route through and none to lose — that is the
  "Decentralized". A full off-platform hop is:</p>
<p class="hop"><code>MA → ASB → local DMS → DDS/RTPS mesh → remote DMS → remote MA</code></p>
<p>This is why the board shows a shaded <b>mesh field</b> with a <b>DMS port</b> on each platform,
  rather than a box in the middle. Drawing a central node would depict exactly the broker the
  architecture does not have. It is also why a "reroute" in this game is not a detour to some relay
  device: it is a second path <i>through another platform's DMS instance</i>.</p>
`;

/** Claims in §1 that are weaker than the rest and must say so. */
export const ARCHITECTURE_CAVEATS: { text: string; prov: Provenance }[] = [
  {
    text: 'The phrase "no central broker" is not stated in those words in any source available here. It follows from the Mission Systems Volume\'s insistence that the interface define no interaction requiring a connection-based network, together with the DDS peer-discovery model — but it is our inference, not a quotation.',
    prov: "inferred",
  },
  {
    text: "DDS (Data Distribution Service) and RTPS (Real-Time Publish-Subscribe) are OMG specifications. A-GRA uses DDS throughout but never expands either acronym.",
    prov: "external",
  },
  {
    text: 'The Start Here Guide calls it the Decentralized "Message" Service; the Mission Systems Volume calls it the Decentralized "Messaging" Service. This project follows the latter.',
    prov: "ask",
  },
];

/* ------------------------------------------------------------------ §2 */

export interface InterfaceRow {
  code: string;
  name: string;
  /** What the volume says the interface covers. */
  flows: string;
  /** Does it cross the contested air? */
  air: "OTA" | "On-platform" | "Mixed" | "Mostly pre-load";
  /** Where the player meets it — honest about absence. */
  inGame: string;
  /** True when the game barely or never exercises it. */
  thin?: boolean;
}

/**
 * Source: Start Here Guide — the six named at L75–79, per-interface detail L90–127.
 * The `air` column is the project's topology guard rail (docs/01 §2a): getting this
 * column wrong is precisely the error CLAUDE.md forbids.
 */
export const INTERFACES: InterfaceRow[] = [
  {
    code: "C2",
    name: "Command and Control",
    flows:
      "Three categories of C2 interaction (Direct, Indirect, Responsive); forming and tasking a team; RBAC for ACPs; the command flows for employing weapons.",
    air: "OTA",
    inGame:
      "The backbone. Task round trips (L1, L7, L8), routine ROE traffic, and the strike-approval gate (L6).",
  },
  {
    code: "P2P",
    name: "Peer-to-Peer",
    flows:
      "Team formation and leader election; distributing the package COP; peer contingencies and state-data sharing.",
    air: "OTA",
    inGame:
      "Package joining (L3), elections (L3, L7), the formation heartbeat (L4), and COP fan-out (L5, L6).",
  },
  {
    code: "MS",
    name: "Mission Systems",
    flows:
      "Message exchange between A-GRA platforms — this is where the DMS lives. Also PNT and system status, sensor and comms interactions, and weapons-related interactions.",
    air: "Mixed",
    inGame:
      "The DMS lifecycle every token walks is MS. As a traffic class of its own: L6's relay link, and L1's PNT service exchange with the local Mission Systems — the four-message sequence that gets the ACP position and time before it is any use to anyone.",
  },
  {
    code: "VI",
    name: "Vehicle Interface",
    flows:
      "MA and Flight Autonomy (FA) responsibilities for safety-criticality; control modes (HSA, Waypoint Following, Curve Following); subsystem status and vehicle state from FA; FA's accept/reject validation. FA always retains control but listens to MA based on mission state.",
    air: "On-platform",
    inGame:
      "The self-loop on L1, L2 and L8 — free, lossless, no bandwidth. Its whole job is to contrast with the C2 traffic beside it: L1 takes off with it, L8 flies the approach with it.",
  },
  {
    code: "MP",
    name: "Mission Planning / Planner",
    flows:
      "The Mission Data Package that many MA interactions depend on being loaded before the mission; a system of plans and sub-plans; ROE settings and other configuration.",
    air: "Mostly pre-load",
    inGame:
      "L4's mission-plan update: a re-tasking pushed from the QB through the leader to a formation member, which then has to share a capped link with the formation heartbeat. One honest appearance rather than none — it is still the thinnest of the six here.",
    thin: true,
  },
  {
    code: "MD",
    name: "Mission Debrief",
    flows:
      "Use cases for mission debrief and replay of MA data; on-board debrief systems and in-flight debrief support.",
    air: "Mostly pre-load",
    inGame:
      "L5's deferrable bulk: the raw sensor observation reports local fusion builds tracks from. The thing you shed under COP pressure — and the reason shedding costs you something, because your own track completeness decays while it is off.",
    thin: true,
  },
];

export const INTERFACES_NOTE_HTML = `
<p><b>The answer to "which interfaces cross the contested air?"</b> — <b>C2</b>, <b>P2P</b>, and the
  <b>MS</b>/DMS and COP updates <i>between platforms</i>. <b>VI is on-platform and cannot be lost to
  the air at all</b>; so are local sensor reads and the MA&#8596;local-MS exchange L1 runs, which is
  why L1's PNT loop sits outside the shaded field next to the VI one. MP is mostly something you paid for on the ground, and MD is the
  deferrable bulk class. If you ever find yourself reasoning about "routing VI traffic across the
  QB link", the board is right and the intuition is wrong: VI is internal wiring.</p>
<p class="thin-note">Rows marked <b>thin</b> above are where this game is lighter than the
  architecture it teaches. All six interfaces now carry real, XSD-named traffic — until WP5 that
  was four of six, with MP exercised by nothing at all and MD faked by sending a C2 message at
  class MD. MP and MD each get one honest appearance rather than a curriculum of their own. That
  is a statement about the game's depth, not about A-GRA.</p>
`;

/** The Start Here Guide contradicts itself on what MP stands for. */
export const MP_NAMING_CAVEAT = {
  text: 'The Start Here Guide\'s body text calls it the "Mission Planning (MP) Interface" while its own acronym table lists "MP — Mission Planner". Both are shown above rather than silently picking one.',
  prov: "ask" as Provenance,
};

/* ------------------------------------------------------------------ §3 */

export interface LifecycleState {
  state: string;
  /** Whether the game has this state. */
  inGame: boolean;
  meaning: string;
}

/**
 * Source: MS Volume, MA_TxDataPayloadCommandStatusMT.DestinationTransmissionStatus.
 * The two SUCCESS_* rows are real A-GRA finals the game collapses into SENT —
 * docs/01 item 21. Showing them is the point: it is the one place the game's
 * vocabulary is knowingly weaker than the standard's.
 */
export const LIFECYCLE_STATES: LifecycleState[] = [
  {
    state: "PENDING",
    inGame: true,
    meaning:
      "Queued to be sent offboard. Cancelling or updating the send is still legal at this point.",
  },
  {
    state: "EXECUTING",
    inGame: true,
    meaning:
      "DMS is actively attempting to send. The send can no longer be cancelled or updated — you are committed.",
  },
  {
    state: "FAIL_UNSENT",
    inGame: true,
    meaning:
      "Some problem — typically loss of comms — stopped the message being sent. You find out early, and retrying is cheap. Note this can happen two ways: removed from the queue before it ever executed, or as a final status.",
  },
  {
    state: "FAIL_MISSING_ACK",
    inGame: true,
    meaning:
      "It was sent over a protocol that supports delivery confirmation, but no confirmation came back. The insidious one: the message may have arrived and been acted on, and you cannot tell. On a return leg — an approval you are waiting for — this is the hardest decision in the game.",
  },
  {
    state: "SUCCESS_NO_ACK_EXPECTED",
    inGame: false,
    meaning:
      "Sent over a protocol with no delivery confirmation available (UDP-like). A-GRA notes that DDS provides no standard way to read message acknowledgements, so this may be the most common status of all.",
  },
  {
    state: "SUCCESS_RECEIVED_ACK",
    inGame: false,
    meaning: "Sent over a confirming protocol, and delivery was confirmed.",
  },
];

export const LIFECYCLE_NOTE_HTML = `
<p><b>The game's <code>SENT</code> is not an A-GRA state.</b> A-GRA defines <b>four</b> final
  statuses; the two beginning <code>SUCCESS_</code> differ in whether an acknowledgement was even
  available to ask for. This game merges them into one confident <code>SENT</code>.</p>
<p>It is worth knowing which way that simplification leans. The standard's own note is that on a
  DDS mesh, <code>SUCCESS_NO_ACK_EXPECTED</code> — <i>sent, and no confirmation was ever going to
  come</i> — <b>may be the most common outcome</b>. The real epistemic position is therefore
  weaker than the game's green <code>SENT</code> suggests. That does not undermine the lesson
  <b>delivery ≠ confirmation</b>; it sharpens it.</p>
`;

/* ------------------------------------------------------------------ §4 */

export interface RoleRow {
  code: string;
  /** Expansion, or null when no source on this device gives one. */
  expansion: string | null;
  authority: string;
  inGame: string;
}

/**
 * [VERIFY C1–C3] The five roles and their authorities come from the design set
 * (docs/01 L44), not from primary text: the C2 Volume, which defines RBAC, is not
 * available on this device. The Start Here Guide confirms only that RBAC exists.
 *
 * The XSD sharpens *what is still missing*. It does not enumerate operator roles at
 * all: `MA_OperatorRoleMDT.Role` is a `ForeignKeyType` with a free-text
 * `RoleDescription`, and the places that gate on a role
 * (`ApproverRoleType.ApproverRole`, `MA_AuthorityCriteriaType.AuthorizedOperatorRoles`)
 * take `OperatorRoleType` *references*. So roles are deployment-configured data, not a
 * schema enum — and no schema check can ever confirm or refute this list. The open
 * question for the C2 Volume is therefore narrower than "are these the five": it is
 * whether A-GRA names a *standard* role set at all, and if so whether it is this one.
 */
export const ROLES: RoleRow[] = [
  {
    code: "Admin",
    expansion: "Administrator",
    authority: "The only role that can re-permission other nodes.",
    inGame: "Not exercised — no level re-permissions anyone.",
  },
  {
    code: "QB",
    expansion: "Quarterback",
    authority:
      "Full command authority except re-permissioning. Sole Target Authority for weapon employment.",
    inGame: "Holds the strike-approval gate in L6, and rejects the RTB request in L7.",
  },
  {
    code: "AVC",
    expansion: null,
    authority: "Flies flight tasks. Weapon-restricted by default.",
    inGame: "Held by peer platforms; the role a misrouted approval request would fail against.",
  },
  {
    code: "LRE",
    expansion: "Launch and Recovery Element",
    authority: "Takeoff, landing and return-to-base.",
    inGame: "The authority for L1's takeoff, L7's RTB and L8's landing round trips.",
  },
  {
    code: "Observer",
    expansion: "Observer",
    authority: "Read-only. May not command.",
    inGame:
      "Held by the relay platform in L6 — it forwards an already-signed approval without acting on it. Forwarding at the messaging layer is not the same as authority.",
  },
];

export const AUTHORITY_HTML = `
<p><b>Authority is checked at the destination.</b> A message arriving somewhere does not make that
  node authorised to act on it. MA checks the sender's role on receipt; if the role does not carry
  the required authority the command is ignored and the status reply comes back
  <code>REJECTED</code> (<code>CannotComply</code>). This is the single idea the campaign returns
  to most often, and the reason a green "delivered" token can still mean nothing happened.</p>
<p class="thin-note">Both halves of that reply are real schema values. <code>ApprovalStatusEnum</code>
  is <code>APPROVED</code> / <code>REJECTED</code> / <code>PENDING</code> / <code>CANCELED</code>,
  and <code>CannotComplyEnum</code> carries a reason that fits this case exactly —
  <code>INELIGIBLE_CONTROL_SOURCE</code>, for when an action is rejected "because the source of the
  action isn't eligible and/or hasn't been granted permission to control … the associated System or
  Capability". What the game collapses is the <i>role set</i> doing the gating, not the gate.</p>
<p><b>Arrival ≠ effect.</b> It is worth separating three things that a player tends to conflate:
  a message <i>arriving</i>, a message being <i>acted on</i>, and you <i>knowing</i> either. The
  DMS lifecycle governs the first and third; RBAC governs the second.</p>
<h4>Weapon employment is a distinct gated flow</h4>
<p>Employing a weapon does not go through the ordinary command path. It runs through a <b>Target
  Authority</b> — the QB — by one of two routes:</p>
<ul>
  <li><b>Approval:</b> <code>MA_ApprovalRequestMT</code> → QB →
    <code>MA_ApprovalRequestStatusMT</code> (APPROVED or REJECTED). This is the path L6 implements.</li>
  <li><b>Designation:</b> <code>MA_DesignationRequestMT</code> → <code>MA_DesignationMT</code>.
    The QB designates rather than approves. Real, and not implemented here.</li>
</ul>
<p>The <b>Target Authority</b> is not the game's coinage. The Rules of Engagement message carries a
  <code>TargetAuthorityCriteria</code> field, and the schema describes the designation route in
  almost the game's words: criteria that can confirm an entity is a Target, "meaning that a
  <code>MA_DesignationRequestMT</code> can be created, and sent to be approved by the related
  <b>Target Authority</b> who would then send a <code>MA_DesignationMT</code>". The field itself
  "specifies who is authorized to approve or set something as a Target". Two rules stated there that
  the game does not model: an MA may not send a <code>MA_DesignationMT</code> for itself, and a
  package Lead may send one to a follower once C2 has already approved the Target.</p>
<p>The approval route is sourced the same way. <code>MA_ApprovalRequestMT</code> carries an
  <code>Approver</code> — an operator role "allowed to approve" — an approval policy, and a
  <code>RespondBy</code> time. That deadline field is the real thing standing behind L6's WEZ clock,
  though A-GRA is more forgiving than the game: if no response arrives by <code>RespondBy</code>,
  "the approval policy's default response will be used", where the game simply lets the window
  close. A further real gate the campaign leaves out entirely: when a package's ROE sets
  <code>StrikeConsentRequired</code>, each strike must also clear a
  <code>StrikeConsentRequestMT</code> round trip with an authorised operator before it can execute.</p>
`;

export const AVC_CAVEAT =
  'AVC\'s expansion is deliberately left blank: no source available on this device gives one. The message schema contains "Unmanned Air Vehicle Control Station", but that is a different concept and using it here would be a guess dressed up as a fact. Tracked as VERIFY C3.';

/* ------------------------------------------------------------------ §5 */

export interface ElectionRow {
  name: string;
  implemented: boolean;
  pattern: string;
  cost: string;
  underStress: string;
  teaches: string;
}

/**
 * [VERIFY P1 resolved, P2 open] The four **method names** are primary-sourced: the
 * normative XSD enumerates them as integers on
 * `MA_LeadershipMetricsMDT.PackageLeaderElectionMethod` — `0` Bully, `1` Static
 * Fitness Score, `2` Maximum Consensus, `3` Raft. There is no fifth; an "Off-Nominal"
 * method the design set once listed here has been removed, having zero hits in the XSD
 * or any volume on this device.
 *
 * What is *not* sourced is the `cost` and `underStress` columns (VERIFY P2). The XSD's
 * own annotation supports three of them qualitatively — Maximum Consensus "preserv[es]
 * communication bandwidth", Raft is "distributed and fault-tolerant", Bully "supports
 * Dynamic Fitness Scores and cases where Leadership Fitness Scores need to be shared" —
 * but the quantitative shapes (O(n²), ~2n) are this project's model. Source: docs/03 §4.
 */
export const ELECTION_METHODS: ElectionRow[] = [
  {
    name: "Static Fitness Score",
    implemented: true,
    pattern: "Pre-loaded scores; the fittest node declares.",
    cost: "Very low — about one message per peer, no negotiation.",
    underStress: "Deterministic and cheap, but inflexible if the fittest node is the one you lost.",
    teaches: "Pre-planning versus adaptivity.",
  },
  {
    name: "Raft",
    implemented: true,
    pattern: "Term, heartbeat and vote; a candidate needs a majority.",
    cost: "Roughly double Static — a vote burst on timeout.",
    underStress: "Clean majority semantics, but stalls outright without a quorum.",
    teaches: "Quorum and terms — and what a partition does to both.",
  },
  {
    name: "Bully",
    implemented: false,
    pattern:
      "Higher-ID nodes are challenged; the loser yields. A-GRA notes it suits cases where fitness scores must be shared as part of the election.",
    cost: "About O(n²) chatter.",
    underStress: "Robust but expensive, and can thrash if links flap.",
    teaches: "The cost of strong consistency.",
  },
  {
    name: "Maximum Consensus",
    implemented: false,
    pattern:
      "Exchange fitness, agree on the maximum. A-GRA's stated reason to pick it is that consensus preserves bandwidth.",
    cost: "A moderate consensus block.",
    underStress: "Adapts, because fitness can be dynamic — e.g. keyed on comms health.",
    teaches: "Dynamic fitness, and its circularity.",
  },
];

export const ELECTION_NOTE_HTML = `
<p>The reason A-GRA names four methods rather than one is that <b>the right choice depends on the
  state of the links you are about to run the election over</b> — and an election is triggered
  precisely when something has gone wrong with those links. Method choice is a decision made under
  the conditions it is meant to survive. The schema treats it as a pre-mission setting: a package
  carries a <code>PackageLeaderElectionMethod</code>, and implementors are expected to define a
  default.</p>
<p>The sharpest case is a <b>dynamic leadership fitness score keyed on comms health</b>, and it is
  real rather than ours. A-GRA lets a package determine fitness statically, by a user-defined rule,
  or <b>dynamically</b> — and it names exactly two dynamic determination methods, both of which are
  comms measurements: <code>C2_CommsBinary</code> (0 for poor or no connection with C2, 1 for
  healthy) and <code>P2P_CommsCount</code> (how many peers the reporting ACP has a healthy
  connection to). So the node with the best links ought to lead — but measuring "best links"
  requires the very links you are trying to assess. That circularity is the observation this game
  adds; the mechanism is the standard's.</p>
<p class="thin-note">This game ships <b>Static</b> and <b>Raft</b> only; the other two are
  reference. One further simplification: real Raft picks a candidate on a randomised election
  timeout, whereas here the fittest node stands as a deterministic stand-in candidate, so that
  replays stay byte-identical. Ties go to the lower node id for the same reason — A-GRA scores
  partners with <code>StaticLeadershipFitnessScore</code> and
  <code>DynamicLeadershipFitnessScore</code> but does not state a tiebreak.</p>
`;

/* ------------------------------------------------------------------ §7 */

export interface GlossaryRow {
  term: string;
  expansion: string | null;
  note?: string;
  prov: Provenance;
}

/**
 * Sourced from the Start Here Guide's acronym table (L156–270) except where the
 * `prov` says otherwise. This table is the acceptance criterion for WP3: every
 * acronym the UI puts on screen must be resolvable here.
 */
export const GLOSSARY: GlossaryRow[] = [
  { term: "ACP", expansion: "Autonomous Collaborative Platform", prov: "ask" },
  { term: "A-GRA", expansion: "Autonomy Government Reference Architecture", prov: "ask" },
  { term: "ASB", expansion: "Abstract Service Bus", prov: "ask" },
  {
    term: "ASK",
    expansion: "A-GRA Starter Kit",
    note: "The release vehicle for the standard; this game targets ASK 5.0a.",
    prov: "inferred",
  },
  {
    term: "AVC",
    expansion: null,
    note: "No expansion appears in any A-GRA source available to this build. Left blank on purpose — see VERIFY C3.",
    prov: "assert",
  },
  { term: "C2", expansion: "Command and Control", prov: "ask" },
  { term: "CAP", expansion: "Combat Air Patrol", prov: "ask" },
  { term: "COP", expansion: "Common Operating Picture", prov: "ask" },
  { term: "DCA", expansion: "Defensive Counter Air", prov: "ask" },
  {
    term: "DDS",
    expansion: "Data Distribution Service",
    note: "An OMG specification. A-GRA uses DDS throughout but never expands it.",
    prov: "external",
  },
  {
    term: "DMS",
    expansion: "Decentralized Messaging Service",
    note: 'The Start Here Guide says "Message Service"; the Mission Systems Volume says "Messaging Service". This project follows the latter.',
    prov: "ask",
  },
  {
    term: "EDF",
    expansion: "Earliest Deadline First",
    note: "A scheduling term, not an A-GRA one — one of the queue policies you can set on a link.",
    prov: "external",
  },
  { term: "FA", expansion: "Flight Autonomy", prov: "ask" },
  { term: "HSA", expansion: "Heading, Speed, Altitude", prov: "ask" },
  { term: "ICD", expansion: "Interface Control Document", prov: "ask" },
  { term: "L1", expansion: "Level 1 — the MA ↔ external interfaces", prov: "ask" },
  {
    term: "L2",
    expansion: "Level 2 — interfaces within MA",
    note: "Not defined in A-GRA 5.0a; the game omits them, which is faithful rather than a simplification.",
    prov: "ask",
  },
  { term: "LRE", expansion: "Launch and Recovery Element", prov: "ask" },
  { term: "MA", expansion: "Mission Autonomy", prov: "ask" },
  { term: "MD", expansion: "Mission Debrief", prov: "ask" },
  {
    term: "MP",
    expansion: "Mission Planner / Mission Planning",
    note: "The Start Here Guide uses both — acronym table and body text disagree.",
    prov: "ask",
  },
  { term: "MS", expansion: "Mission System(s)", prov: "ask" },
  {
    term: "OV-1",
    expansion: "High Level Operational Concept (Operational View 1)",
    note: "The eight-phase DCA vignette this campaign follows.",
    prov: "ask",
  },
  { term: "P2P", expansion: "Peer-to-Peer", prov: "ask" },
  { term: "PNT", expansion: "Position, Navigation, Timing", prov: "ask" },
  { term: "QB", expansion: "Quarterback", prov: "ask" },
  {
    term: "RBAC",
    expansion: "Role Based Access Control",
    note: "Named in the Start Here Guide's body text; the roles themselves are defined in the C2 Volume — see VERIFY C1.",
    prov: "ask",
  },
  { term: "ROE", expansion: "Rules of Engagement", prov: "ask" },
  {
    term: "RTPS",
    expansion: "Real-Time Publish-Subscribe",
    note: "The OMG wire protocol beneath DDS. Not an A-GRA term.",
    prov: "external",
  },
  { term: "RTB", expansion: "Return to Base", prov: "ask" },
  { term: "UCI", expansion: "Universal Command and Control Interface", prov: "ask" },
  { term: "VI", expansion: "Vehicle Interface", prov: "ask" },
  {
    term: "WEZ",
    expansion: "Weapon Engagement Zone",
    note: "In this game, the deadline on the strike-approval round trip: miss it and the engagement is lost.",
    prov: "ask",
  },
  { term: "XML", expansion: "Extensible Markup Language", prov: "ask" },
  { term: "XSD", expansion: "XML Schema Definition", prov: "ask" },
];

/* ------------------------------------------------------------------ §8 */

export interface FidelityNote {
  title: string;
  body: string;
  /** True when the item is faithful rather than a simplification. */
  notASimplification?: boolean;
}

/**
 * The [S] flags from docs/01, in plain language. Grouped as that document groups
 * them. Kept in the player's vocabulary rather than the design set's — the point is
 * that a player can find out what the game fudges without reading the repo.
 */
export const FIDELITY_CORE: FidelityNote[] = [
  {
    title: "Message content is abstracted away",
    body: "Tokens carry no fields. What a message contains is the subject of the other two games in this set; this one is about where messages go.",
  },
  {
    title: "The whole ROE machinery is one approval gate",
    body: "Identity matrices, target custody, geozones and the real Weapon Engagement Zone are collapsed into a single flag that is either satisfied or not.",
  },
  {
    title: "COP is a freshness number",
    body: "Each platform's Common Operating Picture is one staleness value, not a track picture. A breach is any follower below the threshold.",
  },
  {
    title: "Local sensor and PNT reads are free",
    body: "Modelled as cheap on-platform reads. Real Mission Systems has considerably richer tasking handshakes.",
  },
  {
    title: "Intra-MA (L2) interfaces are omitted",
    body: "A-GRA 5.0a does not define them yet, so leaving them out is the accurate choice, not a shortcut.",
    notASimplification: true,
  },
  {
    title: "Time is discrete",
    body: "The sim ticks; real RF is continuous. Bandwidth, latency, loss and burst intermittency are all first-class and tunable, but they are evaluated once per tick.",
  },
  {
    title: "SENT is ours, not A-GRA's",
    body: "A-GRA defines four final transmission statuses; this game merges the two success cases into one SENT. See the lifecycle section — the standard's own position is weaker than ours, not stronger.",
  },
];

export const FIDELITY_MODELLING: FidelityNote[] = [
  {
    title: "Loss is split into two separate probabilities",
    body: "One governs whether a message can get on the air at all this tick (failing to FAIL_UNSENT, gated by the burst-loss channel); the other governs whether a message that left is ever confirmed (FAIL_MISSING_ACK). Keeping them apart keeps the throughput lesson distinct from the confirmation lesson.",
  },
  {
    title: "Reroute is a fixed two-hop path",
    body: "Rerouting the stalled reply sends it through a relay platform's DMS instance rather than over the degraded direct hop — reliable, but slower. The mesh really does route around failures; the fixed path is the simplification.",
  },
  {
    title: "A contested link renders as steadily contested",
    body: "The underlying channel flips between good and bad every tick, which was unreadable on screen. The board damps it; the Inspector and the sim keep the exact state.",
  },
  {
    title: "Tutorial seeds are curated",
    body: "Each level runs one chosen random seed on which the intended lesson reliably lands — passivity loses where it should, the taught action wins. This is seed selection, not tuning: the loss model itself is untouched.",
  },
  {
    title: "The clock pauses at decision points",
    body: "The sim runs at 1 Hz but halts whenever a lesson beat fires, so reading is free. The pause is computed purely and never changes an outcome — headless replays are byte-identical.",
  },
  {
    title: "One lesson per level",
    body: "Levels that are not about loss run over loss-free links, so a bandwidth or authority lesson is not muddied by burst failures. Each message still carries its true interface class.",
  },
  {
    title: "Takeoff, landing and RTB share one message pair",
    body: "The three commands are abstracted into a single task round trip. The authority topology is exact — RTB really is rejected by the QB — but the command semantics are generalised.",
  },
  {
    title: "The team split is scripted, and never auto-merges",
    body: "A two-way partition, with the orphaned half re-electing its own leader. Merging only ever happens on command, which is faithful; the membership model is what is simplified.",
  },
  {
    title: "Static fitness scores are pre-loaded",
    body: "They do not derive from live comms health. The dynamic variant is the more interesting case and is described in the election section, but it would make convergence non-deterministic.",
  },
];

export const FIDELITY_CLOSE_HTML = `
<p><b>None of the above changes topology, endpoints, interface assignment, or authority gating</b>
  — the four things this project's guard rail exists to protect. Where the game simplifies, it
  simplifies content, timing granularity or presentation. It does not move a message onto an
  interface it does not belong on, or let a node act on something it has no authority for.</p>
<p class="thin-note">Some of what this guide states about roles and elections could not be checked
  against primary text on this machine, because two of the ASK 5.0a Interface Volumes are not
  present here. Those claims are chipped <b>design set — unverified</b> throughout, and listed for
  confirmation in <code>docs/VERIFY.md</code>. They are the design set's honest best reading, and
  the code implements exactly what they say — but "asserted" and "sourced" are different things,
  and this guide is the wrong place to blur them.</p>
`;
