# MVP — First Playable

**Target: sheet 1-1 "First Acknowledgement" (World 1 — Ask & Acknowledge),
playable end-to-end in the browser.** Chosen because it exercises the *entire*
loop — compose + validate + handlers + seeds — in one small level: the moment
your composition is stamped `✖ REJECTED` by the validator with real RQMT text,
and the moment your machine survives the out-of-order seed you'd have sworn
couldn't happen. The Blueprint handoff
(`../design_handoff_normal_form_blueprint/`) mocks exactly this sheet and is the
UI spec.

## The sheet

- **Goal (world-state):** *"SystemB performs the tasked activity; you hold
  proof."* Win check: the requestee's activity has executed AND the machine
  reached its terminal state — never "message sent".
- **Palette:** Command-2 only. Concrete binding: `TaskCommand` /
  `TaskCommandStatus` (real UCI 2.5 global elements; `TaskCommandMT` /
  `TaskCommandStatusMT` in the XSD).
- **Roles:** Commander (you) · Commandee (SystemB) — UNIS §4.6's exact role
  names, rendered as the two lifelines.
- **Pars:** **2 messages · 3 handlers · ≤6 ticks.**

## Compose phase — two scripted teaching beats

Player fills the envelope + command fields of the placed `TaskCommand`. The
static validator blocks RUN until clean. Two failures are scripted into the
sheet's initial state (fields pre-filled wrong, as in the Blueprint mock):

1. **Missing `SystemID`** → `✖ ENV HeaderType — MessageHeader missing required
   SystemID` (XSD validity against `uci:HeaderType`; *not* the mock's
   placeholder `SCH-000164` stamp — see fidelity lie #9).
2. **Malformed `CommandID`** (`f81d4fae-7dec-11d0-a765-00a0zzz`) → `✖ RQMT
   USTD-000436 — CommandID is not a valid RFC-4122 UUID` (string form per
   USTD-000673).

Player-visible fields (all real, none renamed):

| Field | Source | MVP behavior |
|---|---|---|
| `SecurityInformation` | `MessageType` first element | read-only marking chip |
| `SystemID` | `HeaderType` | player fills (beat 1) |
| `Timestamp` | `HeaderType` | pre-filled valid |
| `SchemaVersion` | `HeaderType` | pre-filled `002.5` |
| `Mode` | `HeaderType` (`MessageModeEnum`) | pre-filled `LIVE` |
| `CommandID` | `CommandBaseType` (`CommandID_Type` → `ID_Type.UUID`) | player fixes (beat 2) |
| `CommandState` | `CommandBaseType` (`CommandStateEnum`) | pre-filled `NEW`, read-only this sheet |

The response arrow (`← TaskCommandStatus ⟨unset⟩`) is a dashed placeholder until
handlers are wired.

## Handlers phase

One handler widget on the Commander lifeline, keyed on `TaskCommandStatus`'s
`CommandProcessingState` (`CommandProcessingStateEnum`):

- `RECEIVED → wait`
- `ACCEPTED → terminal ✔`
- `REJECTED → retry (budget 1)` — **present but never fires this sheet**
  (SystemB accepts anything well-formed); foreshadows 1-4.

Machine size = 3 (matches par). `CANCELED` is shown in the enum legend but needs
no rule (the sheet's commandee never cancels; the legend links the codex entry).

## Run phase — 3 seeds

Deterministic schedules; SystemB (the scripted requestee) reports RECEIVED at
+2, ACCEPTED at +4, then executes the activity. Seeds disrupt delivery only in
spec-legal ways:

| Seed | Schedule | What it teaches / breaks |
|---|---|---|
| ① `in-order` | deliveries as sent | the happy path; the loop itself |
| ② `ACCEPTED before RECEIVED` | `reorder(RECEIVED, ACCEPTED)` | a machine that hard-sequences RECEIVED→ACCEPTED hangs; UNIS §4 (no ordering) + SPC-001 §5.1.1 (RECEIVED may never be reported) |
| ③ `duplicate after terminal` | `dup(ACCEPTED, +2)` after terminal reached | a machine whose ACCEPTED rule isn't terminal double-counts proof / re-fires; UNIS §4.6.2 (ignore responses after terminal) |

Pass = goal reached on **all three**. Failure replay scrubs to the offending
tick and quotes the violated behavior's CERT text.

## Level JSON sketch

```jsonc
{
  "id": "1-1",
  "world": "w1",
  "title": "First Acknowledgement",
  "goal": {
    "text": "SystemB performs the tasked activity; you hold proof.",
    "win": { "all": [
      { "worldState": "activityExecuted", "party": "SystemB" },
      { "machineState": "terminal", "party": "Commander" }
    ]}
  },
  "palette": [
    { "pattern": "Command-2", "unlocked": true,
      "binding": { "request": "TaskCommand", "response": "TaskCommandStatus" },
      "cite": "UNIS §4.6, CERT UNIS-000105" }
    // Status-1, Data-1, DataRecord-1, DataRequest-2, ActionRequest-2 shown locked
  ],
  "lifelines": [
    { "id": "commander", "label": "Commander (you)", "player": true },
    { "id": "systemB",   "label": "Commandee (SystemB)" }
  ],
  "compose": {
    "initialFields": {
      "SystemID": null,                                  // beat 1
      "Timestamp": "2026-07-02T09:14:03Z",
      "SchemaVersion": "002.5",
      "Mode": "LIVE",
      "CommandID": "f81d4fae-7dec-11d0-a765-00a0zzz",    // beat 2
      "CommandState": "NEW"
    },
    "editable": ["SystemID", "CommandID"]
  },
  "requestee": {                       // scripted respondent config (engine, not code)
    "onCommand": [
      { "report": "RECEIVED", "at": "+2" },
      { "report": "ACCEPTED", "at": "+4", "thenExecuteActivity": true }
    ],
    "rejects": []                      // accepts anything well-formed this sheet
  },
  "seeds": [
    { "id": 1, "label": "in-order", "schedule": [] },
    { "id": 2, "label": "ACCEPTED before RECEIVED",
      "schedule": [ { "op": "reorder", "before": "RECEIVED", "after": "ACCEPTED" } ] },
    { "id": 3, "label": "duplicate after terminal",
      "schedule": [ { "op": "dup", "msg": "ACCEPTED", "delay": 2 } ] }
  ],
  "pars": { "messages": 2, "machineSize": 3, "ticks": 6 },
  "fidelityNotes": ["lie-1-bounded-seeds", "lie-2-visible-bus",
                    "lie-5-retry-budget", "lie-9-placeholder-stamp"],
  "cites": ["CERT UNIS-000105", "UNIS §4", "UNIS §4.6.2",
            "RQMT USTD-000436", "RQMT USTD-000673"]
}
```

*(Note: the Blueprint mock's header chip says "World: One Way", but 1-1 sits in
World 1 "Ask & Acknowledge" — the mock predates the world split. The shipped
sheet chip should read `W1 · Ask & Acknowledge`.)*

## Validator rule list (MVP battery — complete)

Compose-time, pure function, findings quote the source verbatim:

| # | Check | Finding code | Source |
|---|---|---|---|
| V1 | `SystemID` present | `ENV HeaderType` | XSD `HeaderType` (SystemID required) |
| V2 | `Timestamp` present + ISO-8601 | `ENV HeaderType` | XSD `HeaderType` (`DateTimeType`) |
| V3 | `SchemaVersion` present, format per schema-version string | `ENV HeaderType` | XSD `HeaderType` / `UCI_SchemaVersionStringType` |
| V4 | `Mode` ∈ `MessageModeEnum` and matches the sheet's declared mode | `ENV HeaderType` (+ game-rule flag) | XSD `MessageModeEnum`; mode-match is a game rule (fidelity lie #3) |
| V5 | `CommandID` is Leach-Salz (variant 1) or nil UUID | `RQMT USTD-000436` | STD-001 §3 |
| V6 | `CommandID` in canonical string form `xxxxxxxx-xxxx-…` | `RQMT USTD-000673` | STD-001 §3 |
| V7 | `CommandState` ∈ `CommandStateEnum` | `ENV CommandBaseType` | XSD |
| V8 | request/response binding matches the pattern's suffixes (`*Command` / `*CommandStatus`) | `CERT SCH-002461` | SPC-001 §5.1.1 |
| V9 | every placed primitive has both roles bound to lifelines | `CERT UNIS-000105` | UNIS §4.6 (roles) |
| V10 | handler exists for at least the terminal states reachable this sheet | game rule (`READY` gate) | flagged as game rule, not a CERT |

Run-time (engine, not validator — failures replay with the quote):

- terminal-state rule enforced on the machine (post-terminal deliveries must be
  ignored; acting on one is the seed-③ failure) — UNIS §4 / §4.6.2.
- correlation by `CommandID`: a status whose `CommandID` doesn't match is not
  yours (MVP has only one command, but the check exists from day one).

## In scope (MVP build)

- **Core:** seeded bus (reorder/dup/delay ops), Command-2 machine interpreter
  (wait/terminal/retry), scripted-requestee engine, world-state win check,
  3-metric scoring, the V1–V10 battery.
- **Game:** the one screen from the Blueprint handoff, all three phase tabs,
  run controls (PLAY/PAUSE/STEP/RESET, 250–1500 ms tick), failure replay scrub,
  score panel vs pars, Fidelity Notes panel.
- **Fidelity CI:** `check-fidelity.ts` green against `docs/References/` from the
  first commit — the catalog is born policed.

## Explicitly deferred (next slices, in order)

1. World 0 (three sheets — needs multi-consumer fan-out + drop ops + the
   "wrong palette" finding flow).
2. Rest of World 1 (1-2, 1-3 need nothing new; 1-4 needs reject-configured
   requestee + retry-as-NEW enforcement; 1-5/1-6 need the two request patterns
   + `RequestProcessingStateEnum`).
3. World 2 (composed-pattern wiring + `DataRecordInstanceID` correlation +
   found-message ghost lifeline).
4. The Forge (type bench is a separate board mode — biggest new surface).
5. World 4 (palette-cost economy + forged-type import), debrief/bridge screen,
   codex.

## Build order (7 steps, each independently verifiable)

1. **Catalog + fidelity CI.** Envelope, Command-2, both enums, citations;
   codegen to TS; CI green against the References sources.
2. **Seeded bus headless.** vitest: a schedule of reorder/dup ops produces
   byte-stable delivery logs across runs.
3. **Requestee + machine headless.** Reference machine JSON passes all three
   seeds in a golden test. *The sheet is provably solvable before any UI.*
4. **Validator.** V1–V10 battery with verbatim finding text; unit tests per
   rule, including both scripted beats.
5. **Board (SVG) + run view.** Load the reference machine, watch it run: arrows
   reveal per tick, seed strip, metric pills, goal stamp.
6. **Compose + handlers editing.** Build the solution from the sheet's broken
   initial state; delete the reference from the level bundle.
7. **Polish the lesson.** Failure replay with quoted CERT text, Fidelity Notes
   panel, score vs pars, the red drafting stamp.

**Definition of done:** a newcomer who has never read UNIS can, in one sitting,
be blocked by the validator and fix both fields, wire three handlers, watch
seed ② kill their sequencing assumption, fix the machine, pass all three seeds,
and articulate what `CommandProcessingStateEnum` is and why the duplicate
ACCEPTED had to be ignored. (Test on a real human.)
