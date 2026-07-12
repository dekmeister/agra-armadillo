# WS-F continuation — sheets 1-4 and bonus 1-5

Hand-off for a future Claude Code session. WS-F was **staged**: sheets **1-2 and
1-3 are done and green** (this session); **1-4 and bonus 1-5 remain**. Read
`CLAUDE.md`, `docs/01-game-design.md`, `docs/03-levels.md` (W1), and the WS-F entry
in `PLAN_1_0.md` first, then this file.

## What already landed (build on it, don't redo it)

- **1-2 "Skipping the Pleasantries"** (`packages/levels/sheets/w1/sheet-1-2.json`) —
  real sheet replacing the stub. Lesson: RECEIVED is a courtesy. Uses **per-seed
  commandee variants**.
- **1-3 "Rejection Letter"** (`sheet-1-3.json`) — REJECTED kills the CommandID; the
  retry is a fresh NEW command. Uses the **reactive retry loop** + the **reject
  engine**.
- **Engine foundation now in place** (reuse these):
  - `Seed.requestee?` (`packages/core/src/seeds.ts`) — a seed may override the
    commandee behaviour (terse / rejecting), applied in `level/runtime.ts`.
  - **Reactive loop** in `runSeed` (`level/runtime.ts`) — consumes the interpreter's
    `outbound` retry commands, has the commandee `respond(…, attempt)` to each fresh
    command, schedules each round through the same seed, retires the old CommandID
    (stragglers read `not-correlated`), and is budget-bounded (`MAX_RUN_TICKS` guard).
    New `RunEvent` kind `command-retried` (rendered by `frames.ts` + `ValidatorConsole.tsx`).
  - **Reject engine** — `RequesteeConfig.rejects: RequesteeReject[]`
    (`requestee/index.ts`); attempt 0 emits REJECTED with a real `CannotComplyEnum`
    reason (`INVALID_INPUT_PARAMETER`), the retry uses `onCommand`.
  - **Interpreter** (`machine/interpreter.ts`) — retry budget is now decremented
    (`ms.commandsSent - 1 < budget`); retry still sends `NEW` with a derived id.
  - **Catalog** — `CannotComplyEnum` + the real `CommandProcessingStateReason` field
    on `TaskCommandStatus` (`packages/levels/catalog/uci.yaml`, regenerated into
    `generated.ts`; fidelity green).
  - `Emission`/`Delivery` carry an optional `reason` (`bus.ts`).
- **Deterministic proofs**: `packages/core/test/sheet-1-2.golden.test.ts`,
  `sheet-1-3.golden.test.ts` (+ `reference/ref-1-2.json`, `ref-1-3.json`,
  `neg-reject-terminal.json`), and `packages/game/test/w1-play.test.ts` (player-path
  certification + guaranteed-fail lesson + retry frames).

Exit-check baseline is green: `npm test` (66) · `check:types` · `check:types:game` ·
`lint` (1 pre-existing warning) · `check:fidelity` · `vite build`. (`knip` reports
pre-existing unused exports in `store.ts`/`frames.ts` unrelated to WS-F.)

## Fidelity — verified real in the XSD (safe to build on)

`RequestProcessingStateEnum` (line ~138900; values incl. QUEUED, PROCESSING,
COMPLETED, FAILED, CANCELED, REJECTED — **and** NEW/UPDATE/CANCEL and AUTOMATIC_*/
MANUAL_* which the game must **omit**), `RequestStateEnum` (has NEW/UPDATE/CANCEL
among others), `CannotComplyType`/`CannotComplyEnum`, `CommandStatusBaseType`. Concrete
request messages exist, e.g. `SubsystemStatusDataRequest`/`…Status` (DataRequest-2),
`AnalysisRouteRequest`/`…Status` (ActionRequest-2), `ControlRequest`/`…Status`. Grep
`docs/UCI References/UCI_MessageDefinitions_v2_5_0.xsd` (`name="…"` / `value="…"`) and
the spec `.txt` files (`(UNIS|USTD|SCH)-\d{6}`) before citing — `check:fidelity` is the
backstop. Note `docs/02-fidelity.md` §3 lie #8 claims six values; the real enum has
more — omission is allowed, but consider a one-line correction to that lie.

---

## 1-4 "Request Is Not Command" (required)

*Spec: `docs/03-levels.md` W1. `core` + `levels` + `game`.* Two jobs on one sheet:
obtain existing data (DataRequest-2) and cause an analysis to run (ActionRequest-2);
choosing the wrong pattern dead-ends that job's world-state. Command-2 is also in the
palette as the wrong choice for the data job.

Heavy because the whole stack is hardwired to the 4-value `CommandProcessingStateEnum`.

1. **Catalog** (`uci.yaml` → `npm run gen:catalog` → `check:fidelity`): add
   `RequestProcessingStateEnum` (surface QUEUED/PROCESSING/COMPLETED/FAILED/CANCELED/
   REJECTED only) and, if the sheet needs the request-side state, `RequestStateEnum`
   (NEW/UPDATE/CANCEL). Add concrete bindings `SubsystemStatusDataRequest`/`…Status`
   (role request/response) and `AnalysisRouteRequest`/`…Status`, each cited (UNIS
   §4.4/§4.5, CERT UNIS-000093/-000099; SPC-001 §5.1.3/§5.1.2, CERT SCH-002462/-002463).
2. **Enum-driven handler machine** — make the machine's response enum a property of
   the sheet, not a constant:
   - `machine/schema.ts` / `interpreter.ts`: `Rule.on` and the `TERMINAL` set become
     driven by the bound response enum (Command-2's four vs the request enum's set —
     the terminal set differs: COMPLETED/FAILED/CANCELED/REJECTED are terminal, QUEUED/
     PROCESSING are not).
   - `session/index.ts`: `HANDLER_ORDER` and `buildMachine`'s gate are Command-2-only
     today — derive the enum + its terminal states from the sheet; generalize (or gate
     off) the ACCEPTED-only "require RECEIVED first" flag.
3. **Game handler UI** — all currently hardwired to the 4 states:
   `Inspector.tsx` `HANDLER_ENUMS` (line ~241), `tokens.ts` `ENUM_COLOR`
   (`Record<CommandProcessingStateEnum, …>` — add the request enum's colours),
   `frames.ts` `ENUM_NAMES`/`stateOf` (line ~47/54), and the `EnumLegend`/`CODEX`
   blocks. Drive them from the sheet's bound enum.
4. **Two-job runtime** — `runSeed` is single-command/single-machine. Decide first:
   (a) reuse the `jobs`/`JobsBoard` classification path (if the two asks are
   pattern-choice, like 0-3), or (b) a new two-composition Command-2-style board +
   a session that holds >1 placed primitive. (a) is far less surface; prototype it
   before committing to (b).
5. Reference machines + goldens per job; recap line; fidelity notes.

Seeds (per doc): in-order; QUEUED→PROCESSING→COMPLETED long path; skip intermediates
straight to COMPLETED. Recap: "Request returns data or runs a process; Command demands
an activity."

## 1-5 "Cancel Culture" (BONUS — skippable, mark it on the sheet)

*ActionRequest-2 with `RequestState` CANCEL. Heavy + novel.* Win = requestee ends in
CANCELED, no activity executed; the race seed's goal differs ("hold proof of the
outcome, whichever it is").

- **CANCEL as a declarative mid-run input** — RUN is passive playback today
  (`usePlayback.ts` just advances a precomputed run). The architecture-consistent
  route is a `cancelAtTick` plan knob folded into the deterministic run (keep `core`
  pure — no live re-derivation), plus a small RUN-phase input surface in the game. Do
  **not** add a live "player acts at tick N" mutation path.
- **Race seed** — CANCEL races COMPLETED on the unordered bus; the terminal COMPLETED
  can win, and the machine must read the response to know who won. Per-seed goal
  variant (the goal clause differs on this seed).
- Vocabulary already exists: `CommandStateEnum`/`RequestStateEnum` include `CANCEL`;
  `CANCELED` is a terminal response state. The missing pieces are the input surface +
  the `cancelAtTick` handling in `runSeed`.
- Reference machine + golden; recap "CANCEL is a request — the bus decides the race."

## Then

- Register 1-4 (and 1-5) in `packages/levels/src/index.ts` `SHEET_LIST` and update
  `packages/levels/test/registry.test.ts` (the id slice + `nextSheetId` chain).
- Update `docs/03-levels.md` if the design shifts on contact; keep `docs/02-fidelity.md`
  honest about any new apparatus.
- Then WS-G (epilogue debrief + playtest) can close 1.0.
