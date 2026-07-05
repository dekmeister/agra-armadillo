# WS-E (World 0) — critical review + low-level plan

## Context

`PLAN_1_0.md` drives Normal Form from the shipped MVP (sheet 1-1) to the full
1.0. WS-A…WS-D have landed; **WS-E is next**: build World 0 — three sheets
(0-1 Hello Bus, 0-2 Fire and Forget, 0-3 Pattern Choice Is Semantics) that teach
the envelope, the validator gate, and the fire-and-forget `-1` patterns
(Status-1 / Data-1) *before* the player meets the Command-2 handshake in 1-1.

The user asked for (a) a critical review of the high-level WS-E entry and (b) a
lower-level plan to execute it. This document is both. The design intent for the
three sheets is fixed in `docs/03-levels.md` "World 0"; this plan is about the
engine/UI work to realize it, and it flags where `03-levels.md` has an unresolved
design gap that must be closed (docs-first) before code.

---

## Critical review of the WS-E high-level entry

The current WS-E bullet list is directionally right but **materially undersized
and contains one factual error**. The MVP engine is far more Command-2-specific
than the entry implies. Findings from exploring `packages/core`, `packages/game`,
`packages/levels`:

**1. WS-E is ~3–4 sessions of work, not "one focused session."** The entry packs
five net-new cross-cutting capabilities *plus* three sheets + three reference
machines + goldens + fidelity notes. Each capability touches core + levels + game.
This violates the plan's own "sized for one session" contract. It must be staged.

**2. Factual error: the `drop` seed op does not exist.** The entry says the "schema
slot exists in `seeds.ts` vocabulary, unimplemented." It does not — `SeedOp` is a
closed union of exactly `reorder | dup | delay` (`packages/core/src/seeds.ts`);
`drop`/`straggle` appear only in a header *comment* as future intentions. Adding
`drop` is net-new: a `DropOp` interface, a union arm, and an exhaustive
`case "drop"` in `applyOp` (`bus.ts`) — the first op that *removes* a pending
rather than re-timing one.

**3. The load-bearing hidden cost: there is no one-way (`-1`) pattern model at
all.** The entry treats "Status-1/Data-1 pattern semantics" as one bullet. In
fact the entire sim pipeline is request/response Command-2:
- `requestee/respond()` emits `CommandProcessingStateEnum` states for a *received
  command*; `bus.scheduleDeliveries` streams them to a single "Commander";
  `machine/interpreter.react()` tracks `proofCount`/`terminal`;
  `runtime.runSeed` hardcodes `goalHolds = activityExecuted && proofCount >= 1`.
- Status-1/Data-1 have **no response message, no processing-state enum, and are
  "terminal on send"** — the world-state is judged *at the consumer*, and the
  player's authored artifact is a **publication schedule** (when/how often to
  publish), not a per-enum reactive handler machine.
- So W0 needs a *second producer-side sim path* and a *second editor*, not a tweak
  to the Command-2 one. This is the single biggest piece and the design fork the
  plan must resolve first (see "Open design decisions").

**4. The goal evaluator is a prerequisite, and `Goal.win` is currently dead
data.** `runSeed` never reads `sheet.goal.win`; the `WinClause` type
(`level/types.ts`) is carried but unconsumed. No World-0 sheet can pass today
(they have no `activityExecuted`). Both new goals — "console shows status by tick
N" (a **deadline**) and "datum held continuously t6–t12" (a **continuous-interval
hold**, which the engine has no concept of — `goalTick` is instantaneous
first-satisfaction) — require making `runSeed` interpret `Goal.win` and adding new
clause kinds. This is foundational and blocks all three sheets.

**5. Multi-consumer fan-out is a three-layer change.** Two parties are baked into:
Board geometry (`Board.tsx` fixed `xLeft`/`xRight`, `LAYOUT.lifelineLeftPct/RightPct`,
hand-drawn header/line pairs); the arrow model (`frames.ts` `ArrowFrame.dir` is a
binary `request|response`); and the engine (`Party = "commander"|"systemB"`,
single `commander`/`commandee` in `validator/initialComposition`, and a bus that
delivers one stream to one receiver). 0-2 needs 2–4 consumer lifelines driven by
`sheet.lifelines` with per-consumer delivery.

**6. Seed ops are typed to `CommandProcessingStateEnum`.** `ReorderOp.before/after`,
`DupOp.msg`, `DelayOp.msg` all name command *states*. For `-1` patterns the thing
dropped/delayed is a *publication to a specific consumer*, not a command state. The
seed-op target type must generalize (e.g. a publication/consumer selector) — another
cross-cut that lands with the one-way model.

**7. The "wrong palette" finding (0-3) is genuinely novel with zero scaffolding.**
Findings today are all machine-derived from `validate()`; passing is always
"all seeds green." A *player-filed* finding as the pass condition needs: a new
`PlayerAction` variant, session state to hold filed findings, a new `WinClause`
kind, a filing UI affordance, and a catalog finding to quote. Only the finding
*rendering* (`FindingLine`) and the `FINDINGS` catalog shape are reusable.

**What the entry gets right:** the catalog already anticipates W0 (the
`REFERENCE.patterns` codex has Status-1 `unlocksAt: "0-1"`, Data-1 `unlocksAt:
"0-2"`); the sheet registry + persistence are fully de-hardcoded (prepending W0
sheets is a one-file change in `packages/levels/src/index.ts` — `FIRST_SHEET_ID`
follows automatically); the palette already *displays* Status-1/Data-1 as the
ONE-WAY group; and the golden/reference-machine convention generalizes.

---

## Exploration findings (grounding for the plan)

Key file seams the plan builds on:

- **Seeds/bus:** `packages/core/src/seeds.ts` (closed `SeedOp` union),
  `bus.ts` (`applyOp` switch is exhaustive, no `default` — adding a case is
  type-forced). Determinism: sort by `tick`, then authored `order`.
- **Requestee:** `packages/core/src/requestee/index.ts` — `respond()` is the only
  Emission producer; `RequesteeConfig.rejects` is an unused `unknown[]` stub.
- **Interpreter:** `packages/core/src/machine/interpreter.ts` — `react()` +
  `MachineState { proofCount, terminal, fault, … }`; Command-2 only.
- **Runtime/goal:** `packages/core/src/level/runtime.ts` — `runSeed` line 61
  hardcodes the goal; `Goal.win`/`WinClause` (`level/types.ts`) are unread.
- **Validator:** `packages/core/src/validator/validate.ts` — V1–V10 battery; V8
  checks binding *shape* (`CERT SCH-002461`) but never that the *pattern* is
  correct for the sheet → the seam for a "wrong palette" finding.
- **Catalog:** `packages/levels/catalog/uci.yaml` → `tools/gen-catalog.ts` →
  `packages/core/src/messages/generated.ts` (`MESSAGE_CATALOG`, `FINDINGS`,
  `REFERENCE`). Loader `tools/catalog-source.ts` only accepts `role:
  request|response` — a one-way message needs loader work. Fidelity gate
  `tools/check-fidelity.ts` greps every name/CERT/quote.
- **Registry:** `packages/levels/src/index.ts` (the single registration point);
  `packages/levels/test/registry.test.ts` asserts the first-two ids are
  `["1-1","1-2"]` — **will break** when W0 is prepended (must update).
- **Board/UI:** `packages/game/src/{Board.tsx,frames.ts,tokens.ts}` (fan-out),
  `{Palette.tsx,sheet.ts}` + `packages/core/src/session/index.ts` (placement),
  `{ValidatorConsole.tsx}` (finding render / filed-finding affordance).
- **Reference machines/goldens:** `packages/core/test/reference/*.json` +
  `packages/core/test/sheet-*.golden.test.ts`.

---

## Resolved design decisions

1. **Staging:** WS-E splits into **E1 (engine foundation) → E2 (sheets 0-1 & 0-2
   playable) → E3 (sheet 0-3 + filed-finding)**, each an independently shippable
   session. E2/E3 depend on E1; E2 and E3 are largely parallel after E1.
2. **One-way artifact = a publication-schedule editor.** On a `-1` sheet the
   player authors *when/how often to publish* (start tick + republish cadence);
   the sim delivers publications to consumers and the goal is judged at the
   consumer. This is the honest realization of "republication is the only tool."
3. **Datum goes stale after N ticks.** A consumer "holds" the datum for `staleAfter`
   ticks after each received publication; a new publication refreshes it. This is
   what makes drop seeds bite across the whole 6–12 window. Requires a **docs-first
   note in `03-levels.md`** (0-2 entry) defining `staleAfter`.
4. **Keep the filed-finding mechanic** for 0-3 (the one novel 1.0 affordance).

---

## Staged execution plan

**Docs-first (before any stage's code):** update `docs/03-levels.md` — add the
0-2 `staleAfter` staleness rule and confirm the 0-1/0-3 interactions; add a
`02-fidelity.md` simplification row if the one-way model introduces a new omission
(e.g. "the producer's publish cadence is a game control"); and correct the
`PLAN_1_0.md` WS-E entry (the `drop`-op error + the E1–E3 staging). Docs are the
source of truth and change before code.

Registry gating rule across stages: **W0 sheet JSON + goldens are authored in E1
but NOT added to `SHEET_LIST` until they are playable** (goldens import the sheet
JSON directly, so headless proof does not require registration). E2 registers
0-1/0-2; E3 registers 0-3. This keeps the shipped game from ever showing an
unplayable sheet.

### E1 — Engine foundation (core + levels data + goldens; no UI)

Deliver the seams so W0 sheets are *expressible and provably solvable headlessly*.

1. **Declarative goal evaluator** (`packages/core/src/level/{types.ts,runtime.ts}`).
   Turn `WinClause` into a discriminated union: keep `activityExecuted` /
   `machineState:"terminal"` (1-1/1-2 back-compat) and add
   `statusShownBy {party, byTick}` (deadline) and
   `heldContinuously {party, fromTick, toTick}` (interval). Replace the hardcoded
   `goalHolds` in `runSeed` with an evaluator that reads `sheet.goal.win.all`,
   fed by a per-tick world-state accumulator. Interval clauses require checking a
   predicate across *every* tick in the window (new — `goalTick` is currently just
   first-satisfaction); deadline clauses judge at `byTick`.
2. **One-way producer sim path.** Add a `-1` analogue of `respond()`: a producer
   that turns the player's **publish plan** (a list/cadence of publish ticks) into
   publications, one per consumer, at `publishTick + latency`. Track per-consumer
   **held intervals** with `staleAfter` expiry. Dispatch in `runSeed` on the
   sheet's pattern kind (`-1` vs `-2`); keep both paths pure/deterministic. Prefer
   a **parallel `runSeedOneWay`** sharing the generalized bus + goal evaluator over
   overloading the Command-2 `runSeed`.
3. **Generalize the bus + seed ops** (`bus.ts`, `seeds.ts`). Widen `Emission`/
   `Delivery` and the seed-op *target* from `CommandProcessingStateEnum` to an
   abstract key that can name a publication-to-a-consumer, so `reorder/dup/delay`
   work for `-1` deliveries. Add **`DropOp { op:"drop"; target }`** + an exhaustive
   `case "drop"` in `applyOp` that removes the targeted pending. Keep the
   determinism sort (`tick`, then authored `order`).
4. **Engine multi-consumer roles** (`validator/index.ts`, `types.ts`). Generalize
   the two-party model so a `-1` sheet has 1 producer + N consumers driven by
   `sheet.lifelines`; generalize `Party` to lifeline ids. (Board rendering is E2.)
5. **Author W0 sheet data + reference machines + goldens** (`packages/levels/
   sheets/w0/sheet-0-1.json`, `-0-2.json`; `packages/core/test/reference/
   ref-0-1.json`, `-0-2.json`; `packages/core/test/sheet-0-{1,2}.golden.test.ts`).
   The "reference machine" for a `-1` sheet is a reference **publish plan** proven
   to satisfy the goal on all seeds (incl. `drop`), with a negative (a single-send
   plan that fails the drop seed) mirroring the 1-1 golden pattern. Do **not**
   register them yet.

**E1 exit:** `npm test` (new goldens pass; determinism byte-stable), `npm run
check:types` + `check:types:game`, `npm run lint`, `npm run check:fidelity` all
green. No player-visible change yet.

### E2 — Sheets 0-1 & 0-2 playable (game UI + catalog)

1. **Catalog** (`packages/levels/catalog/uci.yaml` + `tools/catalog-source.ts`).
   Add real Status-1 and Data-1 message bindings with citations; **pick concrete
   XSD global elements** (a `*Status` element for Status-1, a bare-name datum for
   Data-1) and verify names/CERTs via `check:fidelity`. Extend the loader to accept
   a one-way message (e.g. `oneway: true` / a `publication` role) — today it only
   accepts `role: request|response`. Run `gen:catalog`; fidelity green.
2. **Publish-plan editor** — the HANDLERS-phase analogue for `-1` sheets: a small
   "publish at tick / every N ticks" control writing the new publish-plan
   `PlayerAction` (`packages/game/src/Inspector.tsx` HandlersBody branches on
   pattern kind; `packages/core/src/session/index.ts` gains the action + folds it).
3. **Board fan-out** (`Board.tsx`, `frames.ts`, `tokens.ts`): render 2–4 consumer
   lifelines from `sheet.lifelines` (array of X positions replacing `xLeft`/
   `xRight`); widen `ArrowFrame` to `from`/`to` lifeline ids; publications render as
   producer→each-consumer arrows. Run log surfaces per-consumer hold / stale / drop.
4. **Pattern-aware placement** (`Palette.tsx`, `sheet.ts`, `session/index.ts`):
   Status-1 (0-1) / Data-1 (0-2) become the unlocked placeable pattern;
   `primaryBinding`/`place()` handle one-way (no-response) bindings.
5. **Author the two sheets to spec** (`03-levels.md` W0): 0-1 envelope literacy —
   the EXERCISE-mode sheet (fidelity lie #3), compose beats (missing `SystemID`,
   blank `Timestamp`, `Mode` mismatch), goal `statusShownBy tick 4`, seeds in-order
   + `delay(+2)`. 0-2 Data-1 fan-out + staleness + republication, goal
   `heldContinuously 6–12`, seeds in-order + `drop(first→consumer2)` + `drop(odd
   sends)`. Fidelity-notes + recap lines per sheet.
6. **Register 0-1, 0-2** in `packages/levels/src/index.ts` (prepend to
   `SHEET_LIST`); **fix `packages/levels/test/registry.test.ts`** (first-two-ids
   assertion). `FIRST_SHEET_ID`/welcome card/`SheetSelect` follow automatically.

**E2 exit:** 0-1 → 0-2 playable end-to-end in the browser, each arriving broken per
the "lesson guaranteed" rule; all exit checks green.

### E3 — Sheet 0-3 + the filed-finding mechanic

1. **Filed-finding engine support:** new `PlayerAction` `fileFinding`
   (`session/index.ts`); session state holds filed findings (persists free via the
   script — no save-schema change); new `WinClause` kind `findingFiled {code}`; the
   "wrong palette" finding added to `uci.yaml` `findings` (policed; cite the
   pattern-naming rule — UNIS §3 Table 3.0-1 / §4.1, e.g. under `CERT UNIS-000076/
   -000081`). The validator seam is V8 (checks binding *shape*, not pattern
   correctness) — add a pattern-vs-sheet check.
2. **Filing UI** (`ValidatorConsole.tsx` / the offending job chip): a "file finding"
   affordance → dispatch `fileFinding`; goal checks it. **Prototype this early** in
   the session (plan mandate); if the interaction changes, note it into
   `03-levels.md` first.
3. **Multi-job sheet support:** 0-3 has three jobs / placed primitives, but
   `session.placed` is a single boolean today — extend to per-job composition (new
   scope; flag if it must slip). Two jobs solved by correct pattern choice; the
   third (the trap) passed by filing the wrong-palette finding, which unlocks W1.
4. **Author 0-3 to spec:** goal = three jobs each reach their world-state / filed
   finding; seeds in-order + `reorder`; recap + fidelity notes; reference
   machine(s)/golden.
5. **Register 0-3**; update `registry.test.ts` for the full `0-1 → 0-2 → 0-3 → 1-1
   → 1-2` order.

**E3 exit (= WS-E done):** 0-1 → 0-3 playable in ~11 min total, each arriving
broken, W1 unlocks off 0-3; goldens + fidelity green.

---

## Critical files by stage

- **E1:** `packages/core/src/level/{types.ts,runtime.ts}`, `seeds.ts`, `bus.ts`,
  `requestee/index.ts` (or a new `producer/`), `validator/index.ts`, `types.ts`;
  `packages/levels/sheets/w0/*.json`; `packages/core/test/reference/ref-0-*.json`
  + `sheet-0-*.golden.test.ts`.
- **E2:** `packages/levels/catalog/uci.yaml`, `tools/catalog-source.ts`,
  `tools/gen-catalog.ts` (regen), `packages/game/src/{Board.tsx,frames.ts,
  tokens.ts,Palette.tsx,sheet.ts,Inspector.tsx}`, `packages/core/src/session/
  index.ts`, `packages/levels/src/index.ts`, `packages/levels/test/registry.test.ts`.
- **E3:** `packages/core/src/{session/index.ts,validator/validate.ts,level/
  types.ts}`, `packages/levels/catalog/uci.yaml`, `packages/game/src/
  {ValidatorConsole.tsx,Palette.tsx}`, `packages/levels/{src/index.ts,
  test/registry.test.ts}`, new 0-3 JSON + golden.
- **Docs (before code each stage):** `docs/03-levels.md`, `docs/02-fidelity.md`,
  `PLAN_1_0.md` (WS-E correction), project `CLAUDE.md` if seams change.

## Verification

Per stage, the standing exit checks (`PLAN_1_0.md` non-negotiables): `npm test`,
`npm run check:types`, `npm run check:types:game`, `npm run lint`, `npm run
check:fidelity` — **all green**; never hand-edit `generated.ts` (edit `uci.yaml` →
`gen:catalog`); no `git add/commit/push`.

- **E1** is proven purely by goldens: a reference publish plan certifies 0-1/0-2 on
  all seeds; a negative (single-send) plan fails the `drop` seed; `runSeed` output
  is byte-stable across repeated runs (determinism assertion, mirroring
  `sheet-1-1.golden.test.ts`).
- **E2/E3** additionally require the **end-to-end browser playtest** (`npm run dev
  -w @normal-form/game`, ≥1024px): play each new sheet cold, confirm it *arrives
  broken*, fix it, watch the run log / fan-out render, reach CERTIFIED, and confirm
  the next sheet unlocks. Use the `/verify` or `/run` skill to drive the app.
- Fan-out readability at 1024px (arrow-label collisions with 3–4 lifelines) is a
  known risk (`REVIEW_MVP.md` Q4) — eyeball it in E2, defer the formal pass to WS-G.
