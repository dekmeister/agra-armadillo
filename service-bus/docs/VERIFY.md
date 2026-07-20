# VERIFY — claims awaiting a primary source

The Field Guide (WP3) marks the provenance of everything it teaches. Most of it is sourced from
ASK 5.0a material present on this device. This file lists what is **not**, so a session on a
machine with the missing volumes can confirm or correct it.

**Rule: do not silently upgrade an entry here to "sourced".** Confirm it against the volume, then
update both the guide's provenance tag and this file in the same change.

## What sources are available where

At `../brain-swap/docs/A-GRA References/` (sibling repo):

| Source | Present? | Covers |
|---|---|---|
| `ASK 5.0a Start Here Guide.doc.txt` | ✅ | OV-1 vignette, six L1 interfaces, acronym table |
| `ASK 5.0a Mission Systems Interface Volume.txt` | ✅ | DMS lifecycle, PNT, sensors, link health |
| `ASK 5.0a Vehicle Interface Volume.txt` | ✅ | VI control modes, FA responsibilities |
| `A-GRA_MessageDefinitions_v5_0_a.xsd` | ✅ | **Normative message-type names** |
| `ASK 5.0a Command and Control Interface Volume` | ❌ | RBAC roles, C2 paradigms, weapon flow |
| `ASK 5.0a Peer Interface Volume` | ❌ | Team formation, leader election, COP, peer contingencies |

## Resolved by the XSD during WP5 — no longer open

WP5 added seven message names, all confirmed against the XSD before any code used them:

- **The PNT service package** (L1, MS class): `SubsystemStatusDataRequestMT`,
  `SubsystemStatusDataRequestStatusMT`, `SubsystemSettingsCommandMT`,
  `MA_PositionReportDetailedMT`. The *sequence* is primary too — MS Volume §1.2.7.1
  "Request PNT Navigation Data" (~L2063–2085) sets it out step by step. Note these
  subsystem messages carry **no `MA_` prefix**; that is how the volume names them.
- **Sensor track distribution** (L5, MD class): `ObservationMeasurementReportMT`, with
  `EntityMT` alongside it in MS Volume §1.2.4.1 (~L1350–1400).
- **The mission-plan push** (L4, MP class): `MA_MissionPlanCommandMT` /
  `MA_MissionPlanCommandStatusMT`.

## Resolved during WP3 — no longer open

The XSD is normative for message-type names and settled most of what was open:

- **11 of the 12 `MA_*` names the game uses are confirmed** as real A-GRA message types:
  `MA_ApprovalRequestMT`, `MA_ApprovalRequestStatusMT`, `MA_DesignationRequestMT`,
  `MA_DesignationMT`, `MA_LeaderUpdateRequestMT`, `MA_PackageManagementCommandMT`,
  `MA_CommAvailableEndpointsMT`, `MA_TaskMT`, `MA_TaskCommandMT`, `MA_TaskStatusMT`,
  `MA_RulesOfEngagementCommandMT`, `MA_CommTeamReportMT`. The approval **and** designation weapon
  flows are therefore primary-sourced at the message-name level.
- **`MA_VehicleCommandMT` was invented** and has been renamed to **`MA_FlightCommandMT`**, which is
  the real VI command (XSD; VI Volume ~L860, and Tables A-1-52/53/56 give its HSA_CSA,
  WaypointFollowing and Heading extensions — exactly the semantics the game attributes to it).
- **The DMS lifecycle** is confirmed against the MS Volume (§DMS, `DestinationTransmissionStatus`).
  The game's `SENT` is a documented collapse of two real finals — `docs/01` item 21.

## Open — needs the **C2 Interface Volume**

| # | Claim | Where it appears | What to check |
|---|---|---|---|
| C1 | The five RBAC roles are **Admin, QB, AVC, LRE, Observer** | Guide §4; `types.ts` `Role`; `docs/01` L44 | Are these the five, with these names? Start Here L95 confirms RBAC exists but does not enumerate. |
| C2 | Per-role authority: Admin re-permissions; QB full command but no re-permissioning; AVC flight tasks, weapon-restricted by default; LRE takeoff/landing; Observer read-only | Guide §4; `docs/01` L44; `rbac.ts` | Confirm each. `adjudicate()` implements QB-only weapon release. |
| C3 | **AVC's expansion** | Guide §4 + §7 — currently **left blank** with a note | Find it. Do **not** use the XSD's "Unmanned Air Vehicle Control Station" — different concept. |
| C4 | Weapon employment sequence: `MA_ApprovalRequestMT → QB → MA_ApprovalRequestStatusMT(APPROVED)`, and `MA_DesignationRequestMT → MA_DesignationMT` | Guide §4, §6; `docs/00` L41–43 | Names are XSD-confirmed; the **sequence and the Target-Authority gate** are not. |
| C5 | Rejection carries `CannotComply` and equals `REJECTED` | Guide §4; `types.ts` `ApprovalStatus` | `CannotComplyType` is real (MS Vol L628 etc.); its use in the RBAC rejection path is not confirmed. |
| C6 | The three C2 paradigms (Direct / Planned / Responsive) | `docs/01` L47 `[S]` | Not surfaced in the guide, but asserted in the design set. |
| C7 | **An AVC may not approve weapon employment** | `scenarios/phase6.ts` (the ACP-3 branch); Guide §4 | **Added WP5.3, and now load-bearing.** The wrong-authority loss is reachable in the tutorial and is one of Phase 6's taught outcomes, so this is no longer a background claim: the level actively teaches that asking an AVC gets you `REJECTED`. If the C2 Volume says an AVC *can* hold delegated release authority, the whole decision branch needs rethinking, not just a copy edit. Settles alongside C2. |

## Open — needs the **Peer Interface Volume**

| # | Claim | Where it appears | What to check |
|---|---|---|---|
| P1 | The five election methods are **Bully, Maximum Consensus, Raft, Static Fitness Score, Off-Nominal** | Guide §5; `types.ts` `ElectionMethod`; `docs/01` L53 | Zero primary hits on this device for any of the five names. |
| P2 | Their message-cost / robustness characterisation | Guide §5 table; `docs/03` §4 L56–71 | Especially Bully ~O(n²) and Raft's quorum stall, which the game teaches as fact. |
| P3 | Ties broken by **highest tail number** from heartbeat | `docs/01` L54; `election.ts` breaks ties by id | Confirm the tiebreak rule. |
| P4 | Dynamic Leadership Fitness Score keys off **Comms Health** | Guide §5 framing quote; `docs/03` L69–71 | The guide quotes this as the interesting case; confirm it is real. |
| P5 | Team split keeps the original PackageID; leaderless half re-forms and re-elects; **never auto-merges** | `docs/01` L56; L7 `mergeTeam` | The "never auto-merge" rule is load-bearing for Phase 7. |
| P6 | `MA_SynchronizeGlobalCopToPeer` | Guide §6; `types.ts` (already `[S]`) | **Absent from the XSD** and missing the `MT` suffix — so the name is probably wrong. Find the real COP-sync message and rename as we did for `MA_FlightCommandMT`. |
| P7 | COP distribution is a P2P responsibility | Guide §2 | Start Here L124–127 supports this at a high level; detail unconfirmed. |
| P8 | **L4's formation heartbeat is `MA_TaskMT` (FollowFormation) over P2P** | `scenarios/phase4.ts`; codex entry | **Added WP5.1.** The XSD has no `MA_Formation*MT` message. `MA_PositionReportMT` exists and would fit a formation heartbeat better, but its use *peer-to-peer* is an interface-assignment claim we cannot check here — the MS Volume only shows `MA_PositionReportDetailedMT` as MS→MA on-platform. We kept the already-justified `MA_TaskMT` rather than trade it for an unverified one. Check the Peer Volume's **"Provide/Receive Formation Status"** interaction and correct the message choice if it names a real one. |

## Open — no A-GRA source expected

| # | Claim | Notes |
|---|---|---|
| X1 | **"No central broker"** | Not stated in those words in any available source. Inferred from MS Vol L515–530 (no connection-based network required, generic asset IDs, multi-hop) plus the DDS peer discovery model. Guide marks this **inferred** — keep it marked unless a volume states it. |
| X2 | **DDS / RTPS** expansions | OMG terms (Data Distribution Service / Real-Time Publish-Subscribe), never expanded in A-GRA. Guide cites OMG, not ASK. |
| X3 | **DMS** = Decentralized **Message** Service (Start Here L109) vs **Messaging** Service (MS Vol L515) | The two volumes disagree. Repo uses "Messaging". Guide shows both. |
| X4 | **MP** = Mission **Planning** (Start Here L114) vs Mission **Planner** (acronym table L218) | Start Here contradicts itself. Guide shows both rather than picking. |
| X5 | **EDF** (earliest-deadline-first) | A game/scheduling term, not A-GRA. Guide labels it as such. |
| X6 | **MD sensor bulk is deferrable, and shedding it degrades local fusion** | Sourced, but worth re-reading. MS Vol §1.2.4.1 states only a *subset* of OMRs are associated with a given track, that fused tracks feed the COP, and that a platform unable to fuse locally can still use pre-fused tracks. WP5.2's whole cost model rests on those three sentences; the *rate* of degradation is ours (`docs/01` item 29). |
