# WS-F continuation — bonus sheet 1-5 "Cancel Culture"

Hand-off for a future Claude Code session. WS-F was **staged**: sheets **1-2, 1-3,
and 1-4 are done and green**. Only the **skippable bonus 1-5** remains. Read
`CLAUDE.md`, `docs/01-game-design.md`, `docs/03-levels.md` (W1), and the WS-F entry in
`PLAN_1_0.md` first, then this file. After 1-5 (or if it's cut), WS-G (epilogue +
playtest) closes 1.0.

## What already landed (build on it, don't redo it)

- **1-2 "Skipping the Pleasantries"** — RECEIVED is a courtesy; per-seed commandee
  variants (`Seed.requestee`).
- **1-3 "Rejection Letter"** — REJECTED kills the CommandID; the **reactive retry
  loop** (`runSeed` consumes the interpreter's `outbound`, commandee responds to the
  fresh NEW command, old id retired, budget-bounded) + the **reject engine**
  (`RequesteeConfig.rejects` with a real `CannotComplyEnum` reason).
- **1-4 "Request Is Not Command"** — built as a **classification sheet** (the 0-3 jobs
  mechanic, extended to `-2` patterns). Player assigns DataRequest-2 / ActionRequest-2
  / Command-2 per job; correct → the request runs to COMPLETED and reaches its
  world-state, wrong (incl. Command-2) → dead-ends. `runSeedJobs` now serves `-2` jobs
  (`JobAsk` gained `dataRequest`/`actionRequest`; `activityExecuted` populated; the
  `request-state` RunEvent shows QUEUED→PROCESSING→COMPLETED). **No** player-wired
  request handler machine was built (deliberate — see below).
- **Catalog** now has `RequestProcessingStateEnum` + concrete `SubsystemStatusDataRequest`/
  `…Status` (DataRequest-2) and `AnalysisRouteRequest`/`…Status` (ActionRequest-2), all
  fidelity-green and auto-populated into the WS-D UCI Reference codex.
- **Engine reusables**: the reactive `runSeed`, per-seed `Seed.requestee`, the reject
  engine, `Emission`/`Delivery.reason`, and the jobs sim (`runSeedJobs`).
- **Proofs**: goldens `sheet-1-2`/`-1-3`/`-1-4` + `packages/game/test/w1-play.test.ts`.

Exit-check baseline green: `npm test` (72) · `check:types` · `check:types:game` ·
`lint` (1 pre-existing warning) · `check:fidelity` · `vite build`. (`knip` reports
pre-existing unused exports in `store.ts`/`frames.ts` unrelated to WS-F.)

## Important: 1-4 chose classification, so 1-5 has no request-handler machine to reuse

1-5 needs a single **ActionRequest-2 conversation that actually runs** (QUEUED→
PROCESSING→…→CANCELED/COMPLETED) with a **player-injected CANCEL**. The jobs/
classification path (`runSeedJobs`) does *not* run a reactive request machine — it
delivers a job outcome. So 1-5 needs either:
- **(A, recommended)** a small dedicated request-run path — the leanest thing that
  simulates an ActionRequest-2 with `RequestProcessingStateEnum` transitions and a
  `cancelAtTick` injection, judged by world-state. Model it after `runSeed`
  (`level/runtime.ts`) but for the request enum; keep it minimal (one conversation,
  no two-job generality). Reuse the reactive-loop shape and the declarative goal
  evaluator (`level/goal.ts`).
- **(B)** the full enum-driven handler generalization (player wires a
  `RequestProcessingStateEnum` machine). Heavier — only do this if the design wants
  the player wiring the request machine here.

Fidelity for the request enum/messages is already done (in the catalog). `RequestStateEnum`
(NEW/UPDATE/CANCEL) is **not** yet in the catalog — add it if 1-5 surfaces the CANCEL
request state (it's a real XSD enum; verify + `gen:catalog` + `check:fidelity`).

## 1-5 "Cancel Culture" (BONUS — optional; mark it on the sheet)

*ActionRequest-2 with `RequestState` CANCEL.* Win = the requestee ends in CANCELED,
no activity executed; the **race seed**'s goal differs ("hold proof of the outcome,
whichever it is").

- **CANCEL as a declarative mid-run input** — RUN is passive playback today
  (`usePlayback.ts` just advances a precomputed run). The architecture-consistent
  route is a `cancelAtTick` plan knob folded into the deterministic run (keep `core`
  pure — no live "player acts at tick N" mutation path), plus a small RUN-phase input
  surface in the game.
- **Race seed** — CANCEL races COMPLETED on the unordered bus; the terminal COMPLETED
  can win, and the machine must read the response to know who won. Per-seed goal
  variant (the goal clause differs on this seed).
- Vocabulary already exists in the XSD: `RequestStateEnum`/`RequestProcessingStateEnum`
  include `CANCEL`/`CANCELED`. The missing pieces are the request-run path (A above),
  the `cancelAtTick` handling, and the input surface.
- Reference machine/plan + golden; recap "CANCEL is a request — the bus decides the
  race."

## Then

- Register 1-5 in `packages/levels/src/index.ts` `SHEET_LIST` and update
  `packages/levels/test/registry.test.ts` (slice + `nextSheetId` chain).
- Keep `docs/03-levels.md` / `docs/02-fidelity.md` honest about any new apparatus
  (docs-first). Mark 1-5 as the bonus (skippable) in the sheet + progression.
- Then WS-G (epilogue debrief + real-human playtest) is the 1.0 release gate.
