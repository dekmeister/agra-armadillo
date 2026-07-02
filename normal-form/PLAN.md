# Normal Form — Design Pack Plan

Plan for a future session: produce the design-doc pack for **Normal Form**, the third
game in the A-GRA teaching suite (alongside `brain-swap/` and `service-bus/`).
**Docs only — no code.** Output goes in `normal-form/docs/`, mirroring the sibling
games' numbered-doc convention.

## Context

Normal Form is a Zachtronics-style browser puzzle game (SpaceChem / TIS-100 mould)
teaching UCI's core grammar — the part A-GRA inherits: the six UNIS message primitive
patterns, the schema style/type rules, and Message Sets / Program Schemas. UCI's
deliberate abstraction (technology-agnostic, multi-domain) is the game's aesthetic,
but every primitive must trace to the standard — if it can't be cited, it's out.

**Decisions already made with the user (do not re-litigate):**
- **Core loop: hostile-bus machine.** Compose a reactive interaction machine per
  role, then RUN it against a transport that legally reorders / drops / duplicates —
  straight from UNIS §4: "no assumption that messages come in any order or that there
  is guaranteed delivery." Challenge = robustness across deterministic seeds.
- **Schema-forge** (constructing message types, versioning puzzles) is a **mid-game
  world**, not the whole game.
- **Static CERT validator is the compose step** inside the loop (blocks Run with
  real CERT-style errors).
- **Board: sequence-diagram board** — lifelines as columns, primitives as draggable
  blocks spanning them. Authentic: UNIS defines each primitive *as* a
  sequence-diagram figure, so the board is the spec's own notation.
- **OAC-SPC-001** (Schema Style & Design Specification) is now present as
  `docs/04_OAC-SPC-001_RevE_UCI_SchemaStyleAndDesignSpecification_v2_5.txt`
  (converted from the docx). Its CERTs use the prefix `CERT SCH-xxxxxx`, and §5.1
  defines the structure of each message primitive pattern from the schema side —
  cite type rules directly from it (no `[SPC-001 §TBD]` markers needed).

## Source anchors (verified against the docs in `normal-form/docs/`)

From `06_OAC-SPC-002_RevA_UCI_NormalizedInterfaceSpecification_v2_5.txt` (UNIS):
- Six primitives + CERTs: Status-1 (CERT UNIS-000076), Data-1 (000081),
  DataRecord-1 (000087), DataRequest-2 (000093), ActionRequest-2 (000099),
  Command-2 (000105); composed patterns DataRecordManagementRequest-3 (000156),
  DataRecordListManagementRequest-3 (000190).
- Bus physics (§4): no ordering, no guaranteed delivery, terminal-state rule
  ("once a terminal state is reported… ignore any further responses").
- Naming: `<PatternName>-n` where n = message count; suffix conventions
  `*Command`/`*CommandStatus`, `*Request`/`*RequestStatus`,
  `*DataRequest`/`*DataRequestStatus`.

From `02_OAC-STD-001_RevI_UCI_StandardDocument_v2_5.txt` (STD-001):
- Compliance RQMTs: USTD-000120 (use schema messages), USTD-000629 (conform to UNIS
  CERTs), USTD-000125 (schema conforms to style spec); UUID RQMTs USTD-000436 /
  USTD-000673 (RFC-4122 Leach-Salz / string form).
- Message Set (§1.2.2, Fig 1.2-5); Program Schema / Extension Message Set /
  Other Messages (§1.2.5, Fig 1.2-6, Glossary).
- Message versioning (§5.2): 4-component `uci:version` designator
  (Indirect-Structural . Direct-Structural . Indirect-Optional . Direct-Optional);
  Structural vs Optional change tables 5.2-1 / 5.2-2 — ready-made puzzle rules.

From `UCI_MessageDefinitions_v2_5_0.xsd`:
- Envelope: abstract `MessageType` = `SecurityInformation` + `MessageHeader`
  (`HeaderType`: SystemID, Timestamp, SchemaVersion, Mode, optional ServiceID,
  MissionID) — around lines 52705 and 44855.
- Enums: `CommandProcessingStateEnum` RECEIVED/ACCEPTED/REJECTED/CANCELED;
  `ProcessingStatusEnum` QUEUED/PROCESSING/COMPLETED/FAILED(/REJECTED);
  `MessageModeEnum` LIVE/EXERCISE/SIMULATION/….
- Conventions: `<MsgName>MT` message types, `*ID_Type` extends `ID_Type`,
  `uci:version` attribute on every type.

## Deliverables — five docs in `normal-form/docs/`

### 01-game-design.md (one-page GDD)
Mirror `brain-swap/docs/01-game-design.md` register. Content:
- **Premise:** you are an integration engineer certifying interactions between
  abstract UCI Components. No aircraft, no domain fiction — the standard's own
  abstraction is the aesthetic (TIS-100's "abstract machine" energy).
- **Core loop:** (1) read goal + palette; (2) **Compose** — drag primitives between
  lifelines, bind message types, fill envelope/ID fields; static validator blocks
  Run with real CERT-style errors; (3) attach **handlers** per response state
  (RECEIVED→wait, ACCEPTED→terminal, REJECTED→retry…) — this is the machine;
  (4) **Run** against N deterministic bus seeds applying only spec-legal disruption
  (reorder, drop for fire-and-forget, duplicate, post-terminal stragglers);
  (5) pass = goal state reached on *all* seeds; then optimize.
- **Scoring (Zachtronics 3-metric):** Messages sent · Machine size
  (handlers + primitives) · Ticks. All-seeds-pass is the gate, not a metric.
- **Win conditions are world-state based** (requestee's activity executed, record
  present in store, subscription delivered N updates) — never "message sent".
  Same principle as Brain Swap.
- **Tone:** clean spec-document aesthetic; failure screens quote the actual CERT
  text; per-level "Fidelity Notes" panel (sibling convention).
- **Bridge paragraph:** primitives keep exact UNIS names; epilogue/debrief shows the
  A-GRA mapping ("`MA_FlightCommand`/`MA_FlightCommandStatus` — you already know
  this shape: Command-2").

### 02-fidelity.md (fidelity decisions + "lies we tell")
Three tables:
1. **Primitive ↔ citation** — every game primitive traced: the 6+2 patterns → UNIS
   CERT numbers; envelope → XSD `MessageType`/`HeaderType`; state enums → XSD;
   UUIDs → USTD-000436/-000673; versioning → STD-001 §5.2 tables; Message Set /
   Program Schema → STD-001 §1.2.5; type/style rules → SPC-001 `CERT SCH-xxxxxx`
   numbers (pattern structures in its §5.1). Guard rail restated: *no primitive
   without a citation.*
2. **Simplifications** — e.g. envelope reduced to 4 player-visible fields
   (SecurityInformation collapsed to a marking chip), single requestee per pattern
   instance, tick-discrete time.
3. **Lies we tell** — bounded seed set stands in for "all legal interleavings"; the
   bus is visible (real UCI prescribes no transport at all); Mode is always LIVE
   except in one teaching level; drops only ever applied to -1 patterns (the spec
   permits loss anywhere; we scope it for teachability — flag this).
Plus the **bridge table**: Normal Form primitive → Brain Swap VI exchange →
Service Bus interaction demand → Conformance Officer check.

### 03-levels.md (progression)
Five worlds, one lesson per level (sibling convention):
- **W0 "One Way"** — Status-1/Data-1: envelope + validator literacy; learn there is
  *no ack* (pattern choice is semantics). First run seeds introduce
  drop-without-recourse.
- **W1 "Ask & Acknowledge"** — DataRequest-2 / ActionRequest-2 / Command-2: state
  handlers; out-of-order (ACCEPTED before RECEIVED), duplicates, post-terminal
  stragglers; REJECTED-path retry budgets; distinguish request (may return data)
  vs command (returns activity).
- **W2 "Records"** — DataRecord-1 + the two -3 composed patterns:
  DataRecordInstanceID, list management; first multi-primitive machines.
- **W3 "The Forge"** (schema-forge world) — construct `<MsgName>MT` types on a type
  bench: derive from MessageType, choice vs sequence, UUID validity, then the
  versioning puzzles ("add this field without a structural bump" via Tables
  5.2-1/5.2-2). Forged types feed later levels' palettes.
- **W4 "Program Schema"** (capstone) — assemble a Message Set under palette-cost
  pressure (adopt only what you need); multi-pattern missions
  (query → command → subscribe); one level requires an Extension Message Set for a
  program-unique message that must still pass the style validator.
Each level entry: goal, palette, seeds, pars, the one lesson, citation.

### 04-tech.md (browser tech choice)
Recommend the sibling stack: TypeScript monorepo (`packages/core` headless
deterministic sim + validator, vitest-tested, sources pars via reference machines;
`packages/game` UI), Vite, biome — matching `brain-swap/` and `service-bus/`
layouts. One divergence, justified: board rendered as **SVG/React** (it's a diagram
with text, animation along lifelines) rather than PixiJS (which siblings use for
maps). Determinism/replay model copied from Brain Swap (recorded input script,
seeded runs).

### 05-mvp.md (MVP first level spec)
**"1-1 First Acknowledgement"** — chosen to exercise the *entire* loop
(compose + validate + handlers + seeds):
- Goal: "SystemB performs the tasked activity; you hold proof."
  Palette: Command-2 only.
- Compose: bind `TaskCommand`/`TaskCommandStatus`, fill SystemID/Timestamp/UUID
  (two seeded validator failures scripted as the teaching beats: missing SystemID;
  malformed UUID).
- Handlers: RECEIVED/ACCEPTED/REJECTED (REJECTED unused here but present —
  foreshadowing).
- Seeds (3): in-order; ACCEPTED-before-RECEIVED; duplicate-status-after-terminal.
- Pars: 2 messages · 3 handlers · ≤6 ticks. Include the full level-JSON sketch and
  validator rule list so implementation is mechanical.

## Execution order
Write 01 → 02 → 03 → 04 → 05 (each doc feeds the next). All four source documents
(STD-001, SPC-001, SPC-002/UNIS, and the XSD) are in `normal-form/docs/`.

## Verification
- Grep-check every CERT/RQMT number cited in the docs against the two `.txt`
  sources and the XSD (no invented citations — the guard rail is mechanical, not
  aspirational).
- Cross-read 02-fidelity's bridge table against `brain-swap/docs/01-game-design.md`
  and `service-bus/docs/00-design-doc.md` so the named A-GRA objects
  (`MA_FlightCommandStatusMT`, `MA_ApprovalRequestMT`…) are the ones those games
  actually use.
- Confirm doc register/structure matches sibling conventions (numbered docs,
  one-lesson-per-level, Fidelity Notes panel).
