# Level Progression

~19 sheets in five worlds. One lesson per level (sibling convention). Each entry:
**goal** (always world-state based), **palette**, **seeds** (deterministic bus
schedules; only spec-legal disruption), **pars** (Messages · Machine size ·
Ticks), the **lesson**, and the **citation**. Optimization re-play is expected.

Seed vocabulary (the whole adversary, each move cited to UNIS §4):
- `in-order` — the polite transport (baseline; every level's seed ①).
- `reorder(a,b)` — deliver b before a (no ordering assumption).
- `drop(msg)` — never deliver (no guaranteed delivery; scoped to -1 patterns,
  fidelity lie #4).
- `dup(msg, +n)` — deliver again n ticks later.
- `straggle(msg, +n)` — deliver a further response after a terminal state was
  reported (terminal-state rule: must be ignored).
- `delay(msg, +n)` — deliver late (no timing assumption).

## World 0 — "One Way" (3 sheets · Status-1, Data-1)

- **0-1 Hello, Bus.** *Goal:* SystemB's console shows your status by tick 4.
  *Palette:* Status-1 only. *Compose beats (scripted validator failures):*
  missing `SystemID`; `Timestamp` blank; `Mode` mismatched to the sheet (this is
  the one EXERCISE-mode sheet — fidelity lie #3). *Seeds (2):* in-order;
  delay(+2). *Pars:* 1 · 1 · ≤4. *Lesson:* every message rides the same envelope
  (`SecurityInformation` + `MessageHeader`); the validator gates Run.
  *Citation:* XSD `MessageType`/`HeaderType`; CERT UNIS-000076.
- **0-2 Fire and Forget.** *Goal:* all three consumers hold the datum
  continuously from tick 6 to tick 12. *Palette:* Data-1. *Seeds (3):* in-order;
  drop(first send to consumer 2); drop(every odd send). A single send passes
  seed ① and fails ② — there is **no ack and no recourse**; the pass is periodic
  republication (Status-1/Data-1 messages are "asynchronous and/or periodic",
  SPC-001 §5.1.6 — periodicity is the producer's choice, and here it's the only
  tool you have). *Pars:* 6 · 2 · ≤12. *Lesson:* -1 patterns give you no proof of
  delivery; terminal state is *on send*. *Citation:* UNIS §4.2, §4.2.2, CERT
  UNIS-000081; UNIS §4 (no guaranteed delivery).
- **0-3 Pattern Choice Is Semantics.** *Goal:* three jobs (announce untracked
  status; publish a datum other components will reference; answer "give me your
  current X" — a trap) each reach their world-state. *Palette:* Status-1, Data-1
  — and the third job's goal is *unreachable* with either; the sheet is passed by
  filing a "wrong palette" finding (an authentic certification outcome), which
  unlocks W1. *Seeds (2):* in-order; reorder. *Pars:* 2 · 2 · ≤6. *Lesson:*
  naming *is* classification — `*Status` / bare name → Status-1 or Data-1;
  `*DataRequest` etc. belong to other patterns; a request needs a -2 pattern.
  *Citation:* UNIS §3 Table 3.0-1 (`<PatternName>-n`, suffixes); §4.1 ("a
  Status-1 message may be named anything that does not match any other primitive
  identifier"); SPC-001 §5.1.6 NOTE (which `*Status` names are *not* Status-1).

## World 1 — "Ask & Acknowledge" (6 sheets · the three -2 patterns)

- **1-1 First Acknowledgement. ← MVP** *Goal:* SystemB performs the tasked
  activity; you hold proof. *Palette:* Command-2 only (`TaskCommand` /
  `TaskCommandStatus`). *Compose beats:* missing `SystemID`; malformed
  `CommandID` UUID. *Handlers:* RECEIVED→wait, ACCEPTED→terminal,
  REJECTED→(present, unused — foreshadowing). *Seeds (3):* in-order;
  reorder(RECEIVED, ACCEPTED); dup(status after terminal). *Pars:* 2 · 3 · ≤6.
  *Lesson:* the command cycle and the terminal-state rule. *Citation:* CERT
  UNIS-000105; UNIS §4.6.2; RQMT USTD-000436/-000673. Full spec: `05-mvp.md`.
- **1-2 Skipping the Pleasantries.** *Goal:* activity performed on a commandee
  that acknowledges tersely. *Palette:* Command-2. *Seeds (3):* in-order with
  RECEIVED; **no RECEIVED at all** (straight to ACCEPTED); straight to REJECTED.
  A machine that *waits for* RECEIVED before arming its ACCEPTED handler hangs on
  seed ②. *Pars:* 2 · 3 · ≤5. *Lesson:* RECEIVED is not guaranteed — "that state
  may not be reported if the Commandee immediately transitions to one of the
  terminal states." *Citation:* SPC-001 §5.1.1 (Fig 5.1-3 state diagram + quoted
  note); CERT UNIS-000105.
- **1-3 The Straggler.** *Goal:* activity performed exactly once; world-state
  fails if the machine re-commands after completion. *Palette:* Command-2.
  *Seeds (3):* in-order; straggle(RECEIVED, +4 after ACCEPTED); dup(ACCEPTED,
  +3). A machine whose ACCEPTED handler isn't terminal double-fires on ③.
  *Pars:* 2 · 3 · ≤8. *Lesson:* "once a terminal state is reported… ignore any
  further responses" — terminal means *stop listening*, and dedupe by
  `CommandID`. *Citation:* UNIS §4 + §4.6.2; XSD `CommandStatusBaseType`
  (correlation by `CommandID`).
- **1-4 Rejection Letter.** *Goal:* activity performed despite the commandee
  REJECTING under-specified commands (the level's commandee rejects any command
  missing a field the sheet flags, with a real `CannotComplyType` reason).
  *Palette:* Command-2, retry budget 1. *Seeds (3):* in-order; REJECTED then
  retry path reordered; straggle(REJECTED dup). Key rule enforced by the
  commandee: REJECTED is **terminal for that CommandID** — the retry must be a
  NEW command with a fresh UUID; an UPDATE to the dead command is ignored (and
  the machine times out). *Pars:* 4 · 4 · ≤10. *Lesson:* terminal states ignore
  all subsequent updates, including CANCEL; a retry is a new sequence.
  *Citation:* XSD `CommandProcessingStateEnum` annotations; SPC-001 Table 5.1-2;
  retry *budget* is a game rule (fidelity lie #5).
- **1-5 Request Is Not Command.** *Goal:* two jobs on one sheet — obtain existing
  data (win: you hold the data) and cause an analysis to run (win: requestee's
  activity executed). *Palette:* DataRequest-2, ActionRequest-2, Command-2 —
  choosing wrong wastes the message budget. *Seeds (3):* in-order;
  QUEUED→PROCESSING→COMPLETED long path; skip intermediates, straight to
  COMPLETED. *Pars:* 4 · 6 · ≤12. *Lesson:* `*DataRequest` returns existing data
  ("implicitly accepted by returning the requested status information");
  `*Request` runs a process that may be queued; `*Command` demands an activity
  as soon as possible — and the two request patterns share the six-value
  `RequestProcessingStateEnum` while Command-2 has its own four.
  *Citation:* CERT UNIS-000093/-000099; SPC-001 §5.1.2/§5.1.3; UNIS §4.4–4.5.
- **1-6 Cancel Culture.** *Goal:* the long-running request must NOT complete
  (mission changed); win = requestee ends in CANCELED, no activity executed.
  *Palette:* ActionRequest-2 with `RequestState` CANCEL. *Seeds (3):* CANCEL
  lands during QUEUED (clean CANCELED); CANCEL lands during PROCESSING; CANCEL
  **races** COMPLETED — the terminal COMPLETED wins on the unordered bus, and the
  machine must detect the loss and handle the world-state honestly (this seed's
  goal line differs: "hold proof of the outcome, whichever it is"). *Pars:* 3 ·
  5 · ≤10. *Lesson:* CANCEL is a request, not a fact; on a bus with no ordering
  you can lose the race, and the response tells you who won. *Citation:*
  `RequestStateEnum`/`RequestProcessingStateEnum` (CANCELED vs COMPLETED both
  terminal); SPC-001 Fig 5.1-6; UNIS §4.

## World 2 — "Records" (3 sheets · DataRecord-1 + the -3 composed patterns)

- **2-1 For the Record.** *Goal:* the record exists in the consumer's store *and*
  is addressable (a later found request must be able to reference it).
  *Palette:* DataRecord-1. The sheet's two variants: with `DataRecordInstanceID`
  (managed) and without (degenerates to Data-1 — the mutually exclusive flows).
  Omitting the ID passes variant 1 and fails variant 2's addressability goal.
  *Seeds (2):* in-order; drop + republish (W0 skill check). *Pars:* 2 · 2 · ≤8.
  *Lesson:* `DataRecordInstanceID` is what makes a datum a *record*; without it
  "the flow acts in the same manner as the Data-1 message pattern." *Citation:*
  UNIS §4.3, CERT UNIS-000087; SPC-001 §5.1.4, CERT SCH-002490.
- **2-2 Record Management.** *Goal:* the store holds exactly the requested
  record-state after a create→update cycle (world-state: final record contents,
  not messages sent). *Palette:* the DataRecordManagementRequest-3 composed
  block — first multi-primitive machine: a DataRecord-1 publication + an
  ActionRequest-2 management pair, wired together. *Seeds (3):* in-order;
  reorder(management status, record publication); straggle(RequestStatus dup
  after COMPLETED). *Pars:* 4 · 6 · ≤12. *Lesson:* composed patterns are just
  primitives with a contract between them — the record message and the
  management request correlate via `DataRecordInstanceID`. *Citation:* UNIS
  §5.1.1, CERT UNIS-000156; SPC-001 §5.1.4.
- **2-3 List Discipline.** *Goal:* the list and its entries are consistent at the
  consumer (every entry's key resolves) despite entries arriving in any order.
  *Palette:* DataRecordListManagementRequest-3 (`ForeignKeyMap` /
  `ForeignKeyPair` as the concrete pair — real UNIS examples). Introduces
  **found messages**: seeds ① and ② open with messages from the ghost lifeline
  (originator "undefined and unrepresented"). *Seeds (3):* in-order;
  reorder(entries); dup(one entry). *Pars:* 5 · 7 · ≤14. *Lesson:* list
  management is record management plus referential integrity; found messages
  mean your machine must be correct even when it didn't see the beginning.
  *Citation:* UNIS §5.1.2, CERT UNIS-000190; SPC-001 §4.3.1.5.

## World 3 — "The Forge" (4 sheets · schema-forge; forged types feed later palettes)

The board becomes a **type bench**: assemble a `<MsgName>MT` from parts
(base-type socket, compositor choice, element slots, attribute rail). The static
validator is the whole adversary here — RUN is replaced by SUBMIT against the
SchemaChecker-style CERT battery. Forged messages join the W4 palette.

- **3-1 Type Bench.** *Goal:* forge a valid `WidgetStatus` message: global
  element + `WidgetStatusMT` (extends `uci:MessageType`, adds `MessageData` of
  `WidgetStatusMDT`) + the MDT. Scripted failures: MT without MDT
  (SCH-000272); lowercase name (SCH-000491); type name ending in nothing
  (SCH-000300). *Pars:* — · 3 declarations · ≤5 submits. *Lesson:* every UCI
  message is the same three-part shape riding the same abstract envelope.
  *Citation:* CERT SCH-000262/-000263/-000272/-000300/-000491; XSD
  `MessageType`.
- **3-2 Choice Words.** *Goal:* model "exactly one of A/B/C" and "A then
  optional B" correctly. Traps: a choice with a `minOccurs=0` member
  (SCH-000651); extending a choice type (SCH-000685/-000687); attributes on a
  sequence (SCH-003081). *Pars:* — · 4 · ≤6 submits. *Lesson:* compositor choice
  is a semantic commitment the style spec polices hard. *Citation:* CERT
  SCH-000651/-000685/-000687/-003081.
- **3-3 Identity Papers.** *Goal:* give the forged record a valid identity:
  `WidgetID` field typed `WidgetID_Type` extending `uci:ID_Type`; populate a
  conforming UUID. Traps: field named `WidgetId` (case), `*ID` field typed as a
  bare string (SCH-000311), non-Leach-Salz UUID (USTD-000436), non-canonical
  string form (USTD-000673). *Pars:* — · 3 · ≤5 submits. *Lesson:* identity is a
  typed construct, not a string convention. *Citation:* CERT
  SCH-000305/-000310/-000311; RQMT USTD-000436/-000673; XSD `ID_Type`.
- **3-4 The Version Bump.** *Goal:* apply three requested changes to a released
  type for the *cheapest correct* `uci:version` bump — "add this field without a
  structural bump" (add it *optional*: Table 5.2-2), "widen this list" (increase
  maxOccurs: optional; decrease: structural), "this enum needs a value" (add:
  optional / delete: structural / rename: treated as add+delete, Table 5.2-3) —
  then trace one **indirect** propagation (a simpleType edit rippling into every
  type that uses it: component A vs B). Grading is mechanical per the tables
  (fidelity lie #6). *Pars:* — · minimal-diff score · ≤6 submits. *Lesson:*
  Structural = code breaks; Optional = cognizance; Direct vs Indirect = where
  you made the change vs where it lands. *Citation:* STD-001 §5.2, Fig
  5.2-1/5.2-4, Tables 5.2-1/5.2-2/5.2-3.

## World 4 — "Program Schema" (3 sheets · capstone world)

- **4-1 Adopt Only What You Need.** *Goal:* complete a three-job mission; the
  palette is the *whole* schema catalog, but every adopted message type costs
  palette points (game economy, fidelity lie #7) — par is unreachable without
  choosing the minimal Message Set. *Seeds (3):* standard W1-grade disruption.
  *Pars:* 6 · 8 · ≤16 (and a Message Set size par: 4 types). *Lesson:* a UCI
  Message Set is "the subset (all or less) of the UCI Messages… used by the AP"
  — adoption is a design decision with a budget. *Citation:* STD-001 §1.2.2,
  Fig 1.2-5, Glossary; RQMT USTD-000120.
- **4-2 Query, Command, Subscribe.** *Goal:* multi-pattern mission on one sheet —
  learn the target's state (DataRequest-2), effect a change (Command-2), then
  hold proof of three subsequent updates (periodic Status-1 consumption). Each
  leg's win is world-state; the seeds interleave the legs (a status update
  arrives mid-command-cycle; the machine must not confuse correlation IDs).
  *Seeds (4):* in-order; cross-leg interleave; straggler after both terminals;
  drop(one status update — republication covers it). *Pars:* 6 · 10 · ≤20.
  *Lesson:* real components run many primitive instances concurrently;
  correlation discipline (which ID belongs to which sequence) is what keeps
  them apart. *Citation:* CERT UNIS-000076/-000093/-000105; UNIS §4.
- **4-3 The Extension (capstone).** *Goal:* the mission needs a program-unique
  message no schema message covers. Forge it (W3 skills) into an **Extension
  Message Set** — it must pass the full style battery ("By definition, an
  Extension Message Set must conform to a UCI Schema Style and Design
  Specification") — then fly the mission with a Program Schema = Message Set +
  Extension. The tempting shortcut: declare it an **Other Message** (no style
  battery — cheaper) — but Other Messages don't conform, and interactions with
  *other UCI Components* must use schema-conformant messages (USTD-000120), so
  the Other-Message lifeline can only reach your own program's components; the
  mission's cross-component leg becomes unwinnable. *Seeds (3):* full
  vocabulary. *Pars:* 7 · 12 · ≤22. *Lesson:* the Program Schema is the escape
  hatch *and* the discipline: extend inside the style rules and you keep
  interoperability; step outside and you're only talking to yourself.
  *Citation:* STD-001 §1.2.5, Fig 1.2-6, Glossary (Extension Message Set /
  Other Messages / Program Schema); RQMT USTD-000120/-000125.

## Epilogue — the A-GRA debrief (not a level)

After 4-3, a debrief screen walks the bridge table (`02-fidelity.md` §4):
each primitive next to its Brain Swap and Service Bus incarnations —
"`MA_FlightCommand` / `MA_FlightCommandStatus` — you already know this shape:
Command-2." The suite's other games become the epilogue's "now play the
sentences" call-to-action.

## Stretch sheets (post-1.0 candidates)

- **Mode Discipline** — an EXERCISE/LIVE mixed sheet, if a citable consumer-side
  behavior can be found; otherwise stays cut (fidelity lie #3).
- **The Sixth Seed** — player-authored seeds: write the disruption schedule that
  breaks a supplied reference machine (adversary mode).
- **PET / abstract types** — SCH-000511/-000512/-000513 (`PET`/`EXT` abstract
  rules) as a Forge bonus sheet.
- **DataRequest under load** — a Requestee with a visible queue; QUEUED depth as
  world-state (needs a citable queue semantics review first).
