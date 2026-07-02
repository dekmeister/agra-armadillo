# Fidelity Decisions

Sources of truth (all in `References/`):
- **UNIS** — `06_OAC-SPC-002_RevA_UCI_NormalizedInterfaceSpecification_v2_5.txt`
  (interaction patterns, `CERT UNIS-xxxxxx`)
- **STD-001** — `02_OAC-STD-001_RevI_UCI_StandardDocument_v2_5.txt`
  (compliance `RQMT USTD-xxxxxx`, Message Set / Program Schema, versioning §5.2)
- **SPC-001** — `04_OAC-SPC-001_RevE_UCI_SchemaStyleAndDesignSpecification_v2_5.txt`
  (schema style `CERT SCH-xxxxxx`; §5.1 defines each primitive's structure from
  the schema side)
- **XSD** — `UCI_MessageDefinitions_v2_5_0.xsd` (envelope, enums, base types,
  concrete message names)

Rule (sibling convention): the game may **omit**, it may **never rename or
invent**. Guard rail, restated: **no primitive without a citation.** A build-time
fidelity check greps the sources for every CERT/RQMT number, message name, field
name, and enum literal in the game's catalog.

## 1. Primitive ↔ citation (every game object traced)

| Game object | Real construct | Citation |
|---|---|---|
| Status-1 block | Status-1 pattern, Producer→Consumer(s), no ack, "fire and forget", terminal on send | UNIS §4.1, **CERT UNIS-000076**; structure SPC-001 §5.1.6 |
| Data-1 block | Data-1 pattern | UNIS §4.2, **CERT UNIS-000081**; structure SPC-001 §5.1.5 |
| DataRecord-1 block | DataRecord-1 pattern; optional `DataRecordInstanceID`; the two flows are mutually exclusive and the ID-less flow "acts in the same manner as the Data-1 message pattern" | UNIS §4.3, **CERT UNIS-000087**; structure SPC-001 §5.1.4, **CERT SCH-002490** (extends `DataRecordBaseType`, optional `DataRecordInstanceID`) |
| DataRequest-2 block | DataRequest-2 pattern, Requester/Requestee; response "implicitly accepted by returning the requested status information" | UNIS §4.4, **CERT UNIS-000093**; structure SPC-001 §5.1.3, **CERT SCH-002462** (`*DataRequest` / `*DataRequestStatus`) |
| ActionRequest-2 block | ActionRequest-2 pattern | UNIS §4.5, **CERT UNIS-000099**; structure SPC-001 §5.1.2, **CERT SCH-002463** (`*Request` / `*RequestStatus`) |
| Command-2 block | Command-2 pattern, Commander/Commandee | UNIS §4.6, **CERT UNIS-000105**; structure SPC-001 §5.1.1, **CERT SCH-002461** (`*Command` / `*CommandStatus`) |
| DataRecordManagementRequest-3 composed block | `<MsgName>` (DataRecord-1) + `DataRecordManagementRequest`/`Status` (ActionRequest-2) | UNIS §5.1.1, **CERT UNIS-000156** |
| DataRecordListManagementRequest-3 composed block | list variant; messages 1 and 2 are **found messages** ("originator… undefined and unrepresented") | UNIS §5.1.2, **CERT UNIS-000190**; list types SPC-001 §4.3.1.5 |
| Pattern naming on chips | `<PatternName>-n`, n = message count | UNIS §3 |
| The hostile bus (seed disruptions) | "no assumption that messages come in any order or that there is guaranteed delivery" | UNIS §4 |
| Terminal-state rule (straggler seeds) | "once a terminal state is reported, the sequence should end… ignore any further responses" | UNIS §4, §4.4.2–4.6.2 |
| Envelope (every placed message) | abstract `MessageType` = `SecurityInformation` + `MessageHeader` | XSD `MessageType` (~line 52705) |
| Envelope fields in the inspector | `HeaderType`: `SystemID`, `Timestamp`, `SchemaVersion`, `Mode`, optional `ServiceID`, `MissionID` | XSD `HeaderType` (~line 44855) |
| Command state chips | `CommandStateEnum` NEW / UPDATE / CANCEL | XSD; SPC-001 §5.1.1 |
| Command response enum (handler rules) | `CommandProcessingStateEnum` RECEIVED / ACCEPTED / REJECTED / CANCELED; ACCEPTED/REJECTED/CANCELED terminal; "RECEIVED… may not be reported if the Commandee immediately transitions to one of the terminal states"; terminal states "ignore all subsequent updates to the Command, including CANCEL" | XSD (~line 113795); SPC-001 §5.1.1 Fig 5.1-3, Table 5.1-2 |
| Request state / response enums | `RequestStateEnum` NEW / UPDATE / CANCEL; `RequestProcessingStateEnum` QUEUED / PROCESSING / COMPLETED / FAILED / CANCELED / REJECTED (last four terminal) | XSD (~line 138900); SPC-001 §5.1.2 Fig 5.1-6, Table 5.1-3 |
| REJECTED reason text | `CommandProcessingStateReason` of type `CannotComplyType` on `CommandStatusBaseType` | XSD `CommandStatusBaseType` (~line 18542) |
| Mode chip | `MessageModeEnum` LIVE / EXERCISE / SIMULATION / NONEXERCISE_SIMULATION | XSD (~line 126502) |
| ID fields / UUID validation | `ID_Type` = `UUID` + optional `DescriptiveLabel`; Leach-Salz variant or nil UUID; canonical string form | XSD `ID_Type` (~line 45004); **RQMT USTD-000436**, **RQMT USTD-000673** |
| Compliance framing (the "certification" fiction) | components use UCI Schema messages; interactions conform to UNIS CERTs; schema conforms to style spec | **RQMT USTD-000120**, **RQMT USTD-000629**, **RQMT USTD-000125** (STD-001 §3) |
| Type bench (W3): MT/MDT construction | `<MsgName>MT` extends `uci:MessageType`, adds `MessageData` of `<MsgName>MDT`; both required per message | **CERT SCH-000262**, **SCH-000263**, **SCH-000272**; canonical shape verified on `TaskCommandMT` |
| Type bench: choice vs sequence rules | choice types: no `minOccurs=0` members, not extended, restricted derivation; sequence: no attributes | **CERT SCH-000651**, **SCH-000685**, **SCH-000687**, **SCH-003081** |
| Type bench: ID typing rules | `*ID_Type` extends `ID_Type`; fields ending `ID` typed accordingly | **CERT SCH-000305**, **SCH-000310**, **SCH-000311** |
| Type bench: naming rules | complexTypes end `Type`/`MT`/`MDT`/…; simpleTypes end `Type`/`Enum`; Pascal case; enum value rules | **CERT SCH-000300**, **SCH-000362/363/364**, **SCH-000491**, **SCH-000394/396/003472** |
| `uci:version` attribute on forged types | only allowed attribute; formatted per `uci:VersionType` | **CERT SCH-000590**, **SCH-002406** |
| Versioning puzzles (W3) | 4-component designator: Indirect-Structural . Direct-Structural . Indirect-Optional . Direct-Optional; change classification | STD-001 §5.2, Fig 5.2-1/5.2-4, **Tables 5.2-1 / 5.2-2 / 5.2-3** |
| Message Set palette (W4) | a subset (all or less) of a UCI Schema | STD-001 §1.2.2, Fig 1.2-5, Glossary |
| Program Schema board (W4) | UCI Message Set + Extension Message Set(s) + Other Messages; Extensions "must conform to a UCI Schema Style and Design Specification" | STD-001 §1.2.5, Fig 1.2-6, Glossary |
| MVP concrete messages | `TaskCommand` / `TaskCommandStatus` (global elements, `TaskCommandMT`/`TaskCommandStatusMT`) | XSD lines ~4438/4444/104225/104249 |

## 2. Simplifications (omissions, never renames)

| Simplification | What's real | Fidelity cost |
|---|---|---|
| Envelope reduced to 4 player-visible fields (`SystemID`, `Timestamp`, `SchemaVersion`, `Mode`) + the pattern's ID field | `HeaderType` also has optional `ServiceID`, `MissionID`; every field kept is real and unrenamed | Low — optional fields omitted, shown in the codex |
| `SecurityInformation` collapsed to a read-only marking chip | required first element of `MessageType`; its type lives in `UCI_SecurityMarkings_v2_5_0.xsd` (a separate schema file in the release, not vendored here) | Player never populates markings; chip states this |
| Single requestee/commandee per pattern instance | -1 patterns explicitly go to "one or more consumers"; -2 patterns are 1:1 in the figures | Multi-consumer appears only for -1 patterns (W0 fan-out), never for -2 |
| Tick-discrete time; 1 tick ≈ 1 bus delivery opportunity | spec has no clock at all — it prescribes *no transport* | The tick is game apparatus; "Ticks" par is a game economy |
| Short display IDs (`CMD-7`) over real UUIDs | `ID_Type.UUID` is the identity; correlation (CommandID ↔ status) preserved exactly | Inspector shows the full UUID; the W0/W1 validator still checks real UUID syntax |
| Handler language is tiny (per-enum rule: wait / terminal / retry n / abort / send X) | the spec puts **no** design implication on the requestee's state machine beyond the terminal rule (UNIS §4) | We constrain the *requester* side for puzzle tractability; flagged in-game |
| MDT payloads abstracted to a small typed field list per level | real MDTs are deep (e.g. `TaskCommandMDT` → `CapabilityCommandBaseType` chains) | Content is the Forge's subject only where the CERT rules bite; elsewhere payload is a token |
| Validator enforces a curated subset of SPC-001 CERTs | the real SchemaChecker enforces all of them programmatically | Each enforced CERT is quoted verbatim; unenforced CERTs are out of palette, not silently passed |

## 3. Lies we tell (explicit; surfaced in the per-level Fidelity Notes panel)

1. **A bounded seed set stands in for "all legal interleavings."** Passing N
   seeds proves robustness against those schedules, not universally. The debrief
   says "certified against 3 adversarial schedules", never "proven correct."
2. **The bus is visible.** Real UCI prescribes *no transport at all* — that
   absence is exactly why the spec forbids ordering/delivery assumptions. We
   render the adversary so the player can reason about it.
3. **Mode is always LIVE except in one teaching level** (W0's envelope sheet runs
   as EXERCISE). The game's "Mode must match the sheet" check is a game rule for
   envelope literacy, not a spec CERT — the spec defines the enum's meaning, not
   a consumer filtering behavior.
4. **Drops are only ever applied to -1 patterns.** The spec permits loss
   *anywhere*; we scope drops to fire-and-forget levels for teachability (a
   dropped -2 request is just a timeout retry lesson, and retry-on-silence is not
   normalized behavior we can cite). Flagged on every -2 sheet: "delivery of
   these arrows is a kindness, not a guarantee."
5. **Retry budgets and timeouts are game rules.** UNIS normalizes what happens
   *after* a response arrives (terminal-state rule); it does not prescribe
   requester timeout/retry policy. The REJECTED-path retry (a *NEW* command with
   a fresh UUID — never an UPDATE, since terminal states ignore updates) is our
   reading of `CommandProcessingStateEnum`'s annotations, and the correct part is
   cited.
6. **The versioning grader is mechanical.** W3 scores a change as
   Structural/Optional × Direct/Indirect straight from Tables 5.2-1/5.2-2. The
   real process also involves OACWG governance, deprecation, and NOSCs (Table
   5.2-2 "Delete" row) — the game grades the classification only.
7. **Palette cost (W4) is a game economy.** STD-001 lets a Message Set be "all or
   less" of the schema freely; the cost pressure models integration/maintenance
   burden, which the standard motivates ("use only the messages they need") but
   does not price.
8. **`ProcessingStatusEnum` is not the -2 response enum.** Early planning notes
   (and UNIS Table 3.0-1's parenthetical) suggest QUEUED/PROCESSING/COMPLETED/
   FAILED/REJECTED; the XSD's `ProcessingStatusEnum` actually lacks REJECTED and
   CANCELED. The game uses **`RequestProcessingStateEnum`** for
   DataRequest-2/ActionRequest-2 responses, which SPC-001 §5.1.2/5.1.3 prescribe
   and which carries all six values.
9. **The Blueprint mock's `SCH-000164` stamp is a placeholder.** The real
   SCH-000164 is about schema-file section ordering. The shipped validator must
   cite honestly: a missing `SystemID` is an XSD validity failure against
   `uci:HeaderType` (rendered as `ENV HeaderType — MessageHeader missing required
   SystemID`), and a malformed UUID cites RQMT USTD-000436/-000673.
10. **Found messages get a ghost lifeline.** UNIS §5.1.2 defines found messages
    as originator "undefined and unrepresented"; the board renders an off-board
    ghost edge so the player has something to receive from. The ghost is
    unlabeled and uncommandable.
11. **"CERT validator" conflates three real regimes.** Schema validity (XSD),
    style CERTs (SPC-001, enforced on the *schema*, i.e. our Forge), and
    interaction CERTs (UNIS, enforced on *behavior*, i.e. our RUN phase) are
    distinct compliance legs (RQMT USTD-000120/-000125/-000629). The game keeps
    the three error prefixes distinct (`ENV` / `CERT SCH` / `CERT UNIS`) so the
    conflation is visible, not hidden.
12. **Duplicates and reorders are seed-scripted, not emergent.** A real
    transport's misbehavior is continuous; ours is an authored schedule per seed
    so failures replay identically (determinism rule).

## 4. Bridge table — the same shape across the A-GRA suite

Brain Swap and Service Bus speak **A-GRA (ASK 5.0a)** messages, which inherit
UCI's grammar; the bridge is shape-level (pattern), verified against what those
games' docs actually use. "Conformance Officer" is the planned fourth game (the
assessment-regime game); its column is forward-looking.

| Normal Form primitive | Brain Swap VI/MS exchange | Service Bus interaction demand | Conformance Officer check (planned) |
|---|---|---|---|
| **Command-2** | `MA_FlightCommandMT` / `MA_FlightCommandStatusMT` (ACCEPTED/REJECTED + `ValidationResult`); `MA_MissionPlanActivationCommandMT`/`StatusMT`; `AMTI_CommandMT`/`AMTI_CommandStatusMT` | `MA_TaskCommandMT` / `MA_TaskStatusMT` round trip (role-gated at MA); `MA_RulesOfEngagementCommandMT`; DMS `MA_TxDataPayloadCommandMT`/`StatusMT` | command cycle: right status enum, terminal discipline |
| **ActionRequest-2** | `MA_ControlRequestMT` / `MA_ControlRequestStatusMT` (the handshake); `StrikeConsentRequestMT` / `StrikeConsentRequestStatusMT` | `MA_ApprovalRequestMT` / `MA_ApprovalRequestStatusMT` (the QB approval gate); `MA_LeaderUpdateRequestMT` | request/response completeness, authority provenance |
| **DataRequest-2** | `SubsystemStatusDataRequestMT` (on-demand status, both FA and MS) | same demand class inside status interactions | data request answered with current data |
| **Status-1** | `ControlStatusMT`; `SubsystemStatusMT` / `ServiceStatusMT` heartbeats; `MA_PositionReportDetailedMT`; `TaskStatusMT` | heartbeats and link-health reports (`MA_CommTeamReportMT`) | periodic publication discipline |
| **Data-1** | `MA_FlightCapabilityMT` (envelope-as-data); `MA_TaskMT` (counter-offer); `EntityMT` tracks; `MA_RoutePlanMT`; `MA_FlightActivityMT` | COP distribution / sensor-track fan-out | capability advertisement present and consumed |
| **DataRecord-1** (+ the two -3 composed patterns) | `MA_FaultMT`; `FileMetadataMT` | Mission Data Package artifacts (MP class pre-load) | record lifecycle managed, not just sent |

(Pattern-classification cross-check: SPC-001 §5.1's example lists put
`PositionReportDetailed`, `ServiceStatus`, `SubsystemStatus`, `TaskStatus` under
Status-1; `<MsgName>Capability`/`Task`/`Plan`/`Activity` and `Entity` under
Data-1; `Fault` and `FileMetadata` under DataRecord-1;
`SubsystemStatusDataRequest`/`ServiceStatusDataRequest` under DataRequest-2 — the
A-GRA analogues in the table follow those shapes.)

## 5. Honesty mechanisms

- **Fidelity CI**: `tools/check-fidelity.ts` extracts every CERT/RQMT number,
  message name, field path, and enum literal from the game's catalog and greps
  the two `.txt` sources and the XSD in `References/`; unknown names fail the
  build. The guard rail is mechanical, not aspirational.
- **In-game Fidelity Notes panel** per level: the subset of §3 the level touches.
- **Failure screens quote the standard**: every RUN failure and validator error
  shows the verbatim CERT/RQMT text with document + section.
- **"In the real standard…" codex**: each primitive and enum links to a note with
  its full context (document, section, figure, omitted fields).
