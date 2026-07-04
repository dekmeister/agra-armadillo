# Level Progression

**1.0 is 7 sheets + 1 bonus + the epilogue debrief — one 30–40 minute
playthrough.** One lesson per level (sibling convention). Each entry: **goal**
(always world-state based), **palette**, **seeds** (deterministic bus schedules;
only spec-legal disruption), the **lesson**, the **recap line** (shown on the
CERTIFIED stamp), the **citation**, and a **~min** budget against the 30-minute
bar. There is no scoring — certification is pass/fail (cut at the MVP review;
see `01-game-design.md`). Every sheet ships a test-only reference machine whose
golden test proves it solvable on all seeds.

Design rule (from the MVP review): **the lesson is guaranteed, not opt-in** —
each sheet arrives broken (wrong fields, or an inherited plausible-but-wrong
machine) so the fail-then-fix beat always fires.

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

- **0-1 Hello, Bus.** *(~3 min)* *Goal:* SystemB's console shows your status by
  tick 4. *Palette:* Status-1 only. *Compose beats (scripted validator
  failures):* missing `SystemID`; `Timestamp` blank; `Mode` mismatched to the
  sheet (this is the one EXERCISE-mode sheet — fidelity lie #3). *Seeds (2):*
  in-order; delay(+2). *Lesson:* every message rides the same envelope
  (`SecurityInformation` + `MessageHeader`); the validator gates Run.
  *Recap:* "Every UCI message rides the same envelope — the validator is the
  gate." *Citation:* XSD `MessageType`/`HeaderType`; CERT UNIS-000076.
- **0-2 Fire and Forget.** *(~4 min)* *Goal:* all three consumers hold the datum
  continuously from tick 6 to tick 12. *Palette:* Data-1. *Seeds (3):* in-order;
  drop(first send to consumer 2); drop(every odd send). A single send passes
  seed ① and fails ② — there is **no ack and no recourse**; the pass is periodic
  republication (Status-1/Data-1 messages are "asynchronous and/or periodic",
  SPC-001 §5.1.6 — periodicity is the producer's choice, and here it's the only
  tool you have). *Lesson:* -1 patterns give you no proof of delivery; terminal
  state is *on send*. *Recap:* "Fire-and-forget has no ack — republication is
  the only tool." *Citation:* UNIS §4.2, §4.2.2, CERT UNIS-000081; UNIS §4 (no
  guaranteed delivery).
- **0-3 Pattern Choice Is Semantics.** *(~4 min)* *Goal:* three jobs (announce
  untracked status; publish a datum other components will reference; answer
  "give me your current X" — a trap) each reach their world-state. *Palette:*
  Status-1, Data-1 — and the third job's goal is *unreachable* with either; the
  sheet is passed by filing a "wrong palette" finding (an authentic
  certification outcome), which unlocks W1. *Seeds (2):* in-order; reorder.
  *Lesson:* naming *is* classification — `*Status` / bare name → Status-1 or
  Data-1; `*DataRequest` etc. belong to other patterns; a request needs a -2
  pattern. *Recap:* "Naming is classification — a request needs a -2 pattern."
  *Citation:* UNIS §3 Table 3.0-1 (`<PatternName>-n`, suffixes); §4.1 ("a
  Status-1 message may be named anything that does not match any other primitive
  identifier"); SPC-001 §5.1.6 NOTE (which `*Status` names are *not* Status-1).

## World 1 — "Ask & Acknowledge" (4 sheets + 1 bonus · the three -2 patterns)

- **1-1 First Acknowledgement. ← built (MVP)** *(~5 min)* *Goal:* SystemB
  performs the tasked activity; you hold proof. *Palette:* Command-2 only
  (`TaskCommand` / `TaskCommandStatus`). *Compose beats:* missing `SystemID`;
  malformed `CommandID` UUID. *Handlers:* RECEIVED→wait, ACCEPTED→terminal,
  REJECTED→(present, unused — foreshadowing 1-3). **The sheet ships with the
  "require RECEIVED first" gate pre-checked** (framed as an inherited
  "sequential handler template") so seed ② is a guaranteed kill; the fix is
  discovering and removing the ordering assumption. *Seeds (3):* in-order;
  reorder(RECEIVED, ACCEPTED); dup(status after terminal) — seed ③ also carries
  the dedupe-by-`CommandID` lesson (the former sheet 1-3 "The Straggler",
  folded in here). *Lesson:* the command cycle and the terminal-state rule.
  *Recap:* "No ordering on the bus; once terminal, stop listening." *Citation:*
  CERT UNIS-000105; UNIS §4.6.2; RQMT USTD-000436/-000673. Full spec:
  `05-mvp.md` + post-review amendments.
- **1-2 Skipping the Pleasantries.** *(~3 min)* *Goal:* activity performed on a
  commandee that acknowledges tersely. *Palette:* Command-2. *Seeds (3):*
  in-order with RECEIVED; **no RECEIVED at all** (straight to ACCEPTED);
  straight to REJECTED. A machine that *waits for* RECEIVED before arming its
  ACCEPTED handler hangs on seed ②. *Lesson:* RECEIVED is not guaranteed —
  "that state may not be reported if the Commandee immediately transitions to
  one of the terminal states." *Recap:* "RECEIVED is a courtesy, not a
  contract." *Citation:* SPC-001 §5.1.1 (Fig 5.1-3 state diagram + quoted
  note); CERT UNIS-000105.
- **1-3 Rejection Letter.** *(~5 min · was 1-4)* *Goal:* activity performed
  despite the commandee REJECTING under-specified commands (the level's
  commandee rejects any command missing a field the sheet flags, with a real
  `CannotComplyType` reason). *Palette:* Command-2, retry budget 1. *Seeds (3):*
  in-order; REJECTED then retry path reordered; straggle(REJECTED dup). Key rule
  enforced by the commandee: REJECTED is **terminal for that CommandID** — the
  retry must be a NEW command with a fresh UUID; an UPDATE to the dead command
  is ignored (and the machine times out). *Lesson:* terminal states ignore all
  subsequent updates, including CANCEL; a retry is a new sequence. *Recap:*
  "REJECTED kills the CommandID — a retry is a new command." *Citation:* XSD
  `CommandProcessingStateEnum` annotations; SPC-001 Table 5.1-2; retry *budget*
  is a game rule (fidelity lie #5).
- **1-4 Request Is Not Command.** *(~5 min · was 1-5)* *Goal:* two jobs on one
  sheet — obtain existing data (win: you hold the data) and cause an analysis
  to run (win: requestee's activity executed). *Palette:* DataRequest-2,
  ActionRequest-2, Command-2 — choosing wrong on either job dead-ends that
  job's world-state. *Seeds (3):* in-order; QUEUED→PROCESSING→COMPLETED long
  path; skip intermediates, straight to COMPLETED. *Lesson:* `*DataRequest`
  returns existing data ("implicitly accepted by returning the requested status
  information"); `*Request` runs a process that may be queued; `*Command`
  demands an activity as soon as possible — and the two request patterns share
  the six-value `RequestProcessingStateEnum` while Command-2 has its own four.
  *Recap:* "Request returns data or runs a process; Command demands an
  activity." *Citation:* CERT UNIS-000093/-000099; SPC-001 §5.1.2/§5.1.3; UNIS
  §4.4–4.5.
- **1-5 Cancel Culture. (BONUS — optional, marked on the sheet; was 1-6)**
  *(~4 min)* *Goal:* the long-running request must NOT complete (mission
  changed); win = requestee ends in CANCELED, no activity executed. *Palette:*
  ActionRequest-2 with `RequestState` CANCEL. *Seeds (3):* CANCEL lands during
  QUEUED (clean CANCELED); CANCEL lands during PROCESSING; CANCEL **races**
  COMPLETED — the terminal COMPLETED wins on the unordered bus, and the machine
  must detect the loss and handle the world-state honestly (this seed's goal
  line differs: "hold proof of the outcome, whichever it is"). *Lesson:* CANCEL
  is a request, not a fact; on a bus with no ordering you can lose the race,
  and the response tells you who won. *Recap:* "CANCEL is a request — the bus
  decides the race." *Citation:* `RequestStateEnum`/`RequestProcessingStateEnum`
  (CANCELED vs COMPLETED both terminal); SPC-001 Fig 5.1-6; UNIS §4.

## Epilogue — the A-GRA debrief (~2 min · not a level)

After 1-4 (1-5 optional), a debrief screen: the sheet-by-sheet recap lines
replayed as a checklist, then the bridge table (`02-fidelity.md` §4) — each
primitive next to its Brain Swap and Service Bus incarnations —
"`MA_FlightCommand` / `MA_FlightCommandStatus` — you already know this shape:
Command-2." The suite's other games become the epilogue's "now play the
sentences" call-to-action.

**Playthrough budget check:** 3+4+4+5+3+5+5 = 29 min core, +4 bonus, +2
epilogue ≈ 31–35 min. The real-human playtest is the release gate: if it
overruns 40 minutes, cut the bonus sheet, not the lessons.

---

## Post-1.0 (cut at the MVP review, designs preserved)

These teach schema *authorship* and program governance — a different audience
from the 30-minute "understand UCI messages" goal. Pars in the archived entries
predate the scoring cut and would not return.

### Cut sheet — 1-3 The Straggler (folded into 1-1 seed ③)

The dup-after-terminal / dedupe-by-`CommandID` lesson (UNIS §4 + §4.6.2; XSD
`CommandStatusBaseType` correlation) is already 1-1's seed ③; a third
consecutive Command-2 sheet didn't earn its minutes. Revive only if playtesting
shows the lesson needs its own sheet.

### World 2 — "Records" (3 sheets · DataRecord-1 + the -3 composed patterns)

- **2-1 For the Record.** *Goal:* the record exists in the consumer's store
  *and* is addressable (a later found request must be able to reference it).
  *Palette:* DataRecord-1. The sheet's two variants: with
  `DataRecordInstanceID` (managed) and without (degenerates to Data-1 — the
  mutually exclusive flows). Omitting the ID passes variant 1 and fails variant
  2's addressability goal. *Seeds (2):* in-order; drop + republish (W0 skill
  check). *Lesson:* `DataRecordInstanceID` is what makes a datum a *record*;
  without it "the flow acts in the same manner as the Data-1 message pattern."
  *Citation:* UNIS §4.3, CERT UNIS-000087; SPC-001 §5.1.4, CERT SCH-002490.
  *(First candidate if a second bonus sheet is ever wanted.)*
- **2-2 Record Management.** *Goal:* the store holds exactly the requested
  record-state after a create→update cycle. *Palette:* the
  DataRecordManagementRequest-3 composed block — first multi-primitive machine:
  a DataRecord-1 publication + an ActionRequest-2 management pair, wired
  together. *Seeds (3):* in-order; reorder(management status, record
  publication); straggle(RequestStatus dup after COMPLETED). *Lesson:* composed
  patterns are just primitives with a contract between them — correlate via
  `DataRecordInstanceID`. *Citation:* UNIS §5.1.1, CERT UNIS-000156; SPC-001
  §5.1.4.
- **2-3 List Discipline.** *Goal:* the list and its entries are consistent at
  the consumer (every entry's key resolves) despite entries arriving in any
  order. *Palette:* DataRecordListManagementRequest-3 (`ForeignKeyMap` /
  `ForeignKeyPair`). Introduces **found messages**: seeds ① and ② open with
  messages from the ghost lifeline (originator "undefined and unrepresented").
  *Seeds (3):* in-order; reorder(entries); dup(one entry). *Lesson:* list
  management is record management plus referential integrity; found messages
  mean your machine must be correct even when it didn't see the beginning.
  *Citation:* UNIS §5.1.2, CERT UNIS-000190; SPC-001 §4.3.1.5.

### World 3 — "The Forge" (4 sheets · schema-forge; type bench board mode)

The board becomes a **type bench**: assemble a `<MsgName>MT` from parts
(base-type socket, compositor choice, element slots, attribute rail). The
static validator is the whole adversary; RUN is replaced by SUBMIT against the
SchemaChecker-style CERT battery.

- **3-1 Type Bench.** Forge a valid `WidgetStatus` message: global element +
  `WidgetStatusMT` (extends `uci:MessageType`, adds `MessageData` of
  `WidgetStatusMDT`) + the MDT. Scripted failures: MT without MDT (SCH-000272);
  lowercase name (SCH-000491); type name ending in nothing (SCH-000300).
  *Citation:* CERT SCH-000262/-000263/-000272/-000300/-000491; XSD
  `MessageType`.
- **3-2 Choice Words.** Model "exactly one of A/B/C" and "A then optional B".
  Traps: a choice with a `minOccurs=0` member (SCH-000651); extending a choice
  type (SCH-000685/-000687); attributes on a sequence (SCH-003081).
- **3-3 Identity Papers.** `WidgetID` field typed `WidgetID_Type` extending
  `uci:ID_Type`; conforming UUID. Traps: `WidgetId` (case), `*ID` as bare
  string (SCH-000311), non-Leach-Salz UUID (USTD-000436), non-canonical form
  (USTD-000673). *Citation:* CERT SCH-000305/-000310/-000311; RQMT
  USTD-000436/-000673; XSD `ID_Type`.
- **3-4 The Version Bump.** Cheapest correct `uci:version` bump for three
  requested changes, per STD-001 §5.2's change tables, plus one indirect
  propagation trace. *Citation:* STD-001 §5.2, Fig 5.2-1/5.2-4, Tables
  5.2-1/5.2-2/5.2-3; grading is mechanical (fidelity lie #6).

### World 4 — "Program Schema" (3 sheets · capstone world)

- **4-1 Adopt Only What You Need.** Message Set selection under palette-cost
  pressure (game economy, fidelity lie #7). *Citation:* STD-001 §1.2.2, Fig
  1.2-5, Glossary; RQMT USTD-000120.
- **4-2 Query, Command, Subscribe.** Multi-pattern mission; interleaved legs;
  correlation discipline across concurrent primitive instances. *Citation:*
  CERT UNIS-000076/-000093/-000105; UNIS §4.
- **4-3 The Extension (capstone).** Forge a program-unique message into an
  Extension Message Set (full style battery) vs the Other-Message shortcut that
  breaks cross-component interoperability (USTD-000120). *Citation:* STD-001
  §1.2.5, Fig 1.2-6, Glossary; RQMT USTD-000120/-000125.

### Stretch sheets (post-1.0 candidates)

- **Mode Discipline** — an EXERCISE/LIVE mixed sheet, if a citable
  consumer-side behavior can be found; otherwise stays cut (fidelity lie #3).
- **The Sixth Seed** — player-authored seeds: write the disruption schedule
  that breaks a supplied reference machine (adversary mode).
- **PET / abstract types** — SCH-000511/-000512/-000513 (`PET`/`EXT` abstract
  rules) as a Forge bonus sheet.
- **DataRequest under load** — a Requestee with a visible queue; QUEUED depth
  as world-state (needs a citable queue semantics review first).
