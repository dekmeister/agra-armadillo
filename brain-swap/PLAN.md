# Plan — Build out more Brain Swap levels (post-MVP)

> Status: approved plan, not yet implemented. Pick up here in a future session.

## Context

The MVP (level 1.2 "First Valid HSA Command") is complete and golden-tested. The
user wants several more **playable, testable** levels "across the board," with an
eye on enjoyable-but-real learning, plus a flag of game improvements.

The hard reality from exploring the engine: the docs (`docs/03-levels.md`)
describe ~22 levels, but the implemented engine is much smaller than the design.
Most later worlds need whole new subsystems (route state machine, curves, faults,
fuel/wind models, brain timers/variables/blocks) — that is engine work, not level
authoring. The categories reachable now are **World 1 (HSA/CSA — the engine's home
turf)** and the **World 4 brain-swap thesis (cheap via new airframes)**.

Decisions confirmed with the user:
- **Scope:** depth-first — World 1 + World 4 portability. ~5 new levels.
- **Engine changes:** additive (even breaking) changes to `packages/core` are
  welcome where they improve the game; active development, fix-as-we-go.

**Goal of this batch:** 5 new golden-tested levels (1.1, 1.3, 1.4, 4.1, 4.5),
2 new airframes, a generalized objective model, and **zero new message types**
(the existing 9-message catalog covers all of it — fidelity stays clean).

---

## What today's engine supports (ground truth)

- Win predicate: a **single** reach-and-hold zone (`zone` + `altitude` band +
  `holdTicks`), evaluated in `packages/core/src/level/runtime.ts` from vehicle
  state only.
- FA (`packages/core/src/fa/engine.ts`): boots capability + AVAILABLE; ACQUIRE/
  RELEASE control with `approvalLatencyTicks` (0 = instant, >0 = PENDING→APPROVED,
  **already implemented**); flight-command envelope validation →
  `PERFORMANCE_LIMIT_EXCEEDED` / `CAPABILITY_NOT_SUPPORTED`
  (`packages/core/src/fa/validator.ts`); silent ignore-when-not-controller;
  periodic position + activity reports.
- Brain (`packages/core/src/brain/schema.ts`): states, transitions, one field
  guard, send actions; value exprs `literal` / `{msg}` / `{cap}`. **No timers /
  variables / blocks.** `cap.MaxAltitude` etc. are exposed to the brain via
  `capContext` in `sim.ts`.
- New **airframes** are nearly free: a body JSON + one entry in the `BODIES` map
  (`packages/levels/src/index.ts`).

Implication: handshake-hold and racetrack levels need a small, additive change to
the **objective model**; everything else is data only.

---

## Engine changes (additive; keep 1.2 byte-identical)

### 1. Generalize the objective into a discriminated union
`packages/core/src/level/types.ts` — replace the single `Objective` with:

- `kind: "reach-hold"` — existing fields (`zone`, `altitude`, `altitudeTolerance`,
  `holdTicks`). Migrate `level-1.2.json` to include `"kind": "reach-hold"`. The
  1.2 golden log is unaffected (golden = message log, not objective shape).
- `kind: "hold-control"` — `{ holdTicks }`. Win = MA is the secondary controller
  of `level.capabilityId` for `holdTicks` consecutive ticks. **No flight.** (Level 1.1)
- `kind: "waypoint-sequence"` — `{ waypoints: Array<{zone, altitude?, altitudeTolerance?}>, holdTicks }`.
  Win = reach each waypoint in order; the final one must hold `holdTicks`. (Level 1.4)

Also add optional authoring/teaching fields to `LevelDef` (see Improvement #3):
`brief?: string`, `teaches?: string`, and `bodies?: readonly string[]` (for 4.5).

### 2. Carry objective progress in the world
`packages/core/src/world.ts` — generalize `holdTicks` to carry sequence progress:
add `waypointIndex: number` (or a small `progress` object) alongside `holdTicks`;
init to 0 in `initWorld`.

### 3. Teach `evaluateWin` the new kinds
`packages/core/src/level/runtime.ts` — switch on `objective.kind`:
- `reach-hold`: unchanged logic.
- `hold-control`: needs FA state — read `fa.secondaryControllers[capabilityId] === MA`.
- `waypoint-sequence`: advance `waypointIndex` when the current waypoint predicate
  holds; apply `holdTicks` only on the last waypoint.

Change the signature to also accept `fa` and the progress object.

### 4. Wire it through the orchestrator
`packages/core/src/sim.ts` Phase E — pass `fa`, `vehicle`, and progress into
`evaluateWin`; thread the returned progress back into the new `World`.

### 5. Multi-body scoring helper (for 4.5)
`packages/core/src/score.ts` — add `aggregateWorst(scores: Score[]): Score`
(per-metric worst). `packages/levels/src/index.ts` — add a helper that builds a
scenario per body for a level's `bodies` list.

> No catalog/message changes → `tools/check-fidelity.ts` is untouched and still green.

---

## New airframes (`packages/levels/bodies/`)

- **`ax-02.json` "Heron"** — `approvalLatencyTicks: 3` (PENDING→APPROVED flow),
  lower ceiling (`maxAltitude` ~8000), lower `maxAirspeed`, slow `maxTurnRateDeg`
  (~3). Drives levels 1.3, 4.1, 4.5.
- **`ax-03.json` "Ferret"** — agile: high `maxTurnRateDeg` (~10), higher
  `minAirspeed`, narrower altitude band. For the 4.5 triple.

(`maxTurnRateDeg`/`maxAltitude`/airspeeds are real-shaped performance numbers —
fidelity lie #6.) Register all three in the `BODIES` map.

---

## New levels (each: `level-X.Y.json` + `*.reference-brain.json` + golden test)

All under `packages/levels/worlds/world-N/`, tests under `packages/levels/test/`.
Tests mirror `level-1.2.golden.test.ts`: ref brain wins, byte-stable golden log,
exact MA sends, stable scores == `pars`, determinism, disposition checks.

### World 1 — HSA/CSA

- **1.1 Handshake** — body `ax-01`, `objective.kind: "hold-control"`, `holdTicks: 30`.
  Ref brain: await `MA_FlightCapabilityStatusMT` AVAILABLE → `MA_ControlRequestMT`
  ACQUIRE → `MA_ControlRequestStatusMT` APPROVED → confirm via `ControlStatusMT`
  `SecondaryController == MA` → hold. **Bait** (documented, optional negative-brain
  test): a brain that sends `MA_FlightCommandMT` first → `ignored-not-controller`.
  Teaches the control-acquisition handshake. Existing messages only.

- **1.3 Envelope** — body `ax-02` (ceiling ~8000), `reach-hold` zone at altitude =
  ceiling. **Naive brain** commands above ceiling → `PERFORMANCE_LIMIT_EXCEEDED`
  (ship as a negative test asserting the rejection). **Ref brain** clamps using
  `Altitude: { cap: "MaxAltitude" }` → accepted, 0 rejections. Teaches
  envelope-as-data + the rejection enum. `pars.rejections: 0` only reachable by
  reading the profile. Existing engine/messages.

- **1.4 Racetrack** — body `ax-01`, `objective.kind: "waypoint-sequence"` (4 corner
  zones, axis-aligned circuit). Ref brain: handshake → one `NEW` full command to
  start, then on each `MA_PositionReportDetailedMT` whose Longitude/Latitude crosses
  a corner threshold, send a **Direction-only `UPDATE`** (`CommandState: UPDATE`,
  `Heading` only). Teaches partial UPDATE vs NEW + the bus-traffic par. Corners use
  single-field position guards (no timer needed).

### World 4 — Brain Swap

- **4.1 Second Body** — body `ax-02` (Heron). Re-fly the 1.2 HSA mission. Ref brain
  is **profile-driven**: clamps altitude/speed via `cap.*`, waits for APPROVED (so
  the PENDING flow "just works"). Contrast: a brain that hardcoded 1.2's numbers
  hits `PERFORMANCE_LIMIT_EXCEEDED`. Teaches portability via profile-reading.

- **4.5 Type Certificate (lite)** — one **locked** brain, `bodies: ["ax-01","ax-02","ax-03"]`,
  same `reach-hold` mission. Golden test runs the locked brain on all three bodies,
  asserts each wins, records `aggregateWorst` of the three scores. Proves the
  namesake. (Full UI/score-screen deferred; this is the headless proof.)

### Index wiring
`packages/levels/src/index.ts` — import + export each level JSON and reference
brain (`level11`, `level11ReferenceBrain`, …), and add `ax-02`/`ax-03` to `BODIES`.

---

## Game improvements flagged (enjoyable-learning philosophy)

1. **Objective model generalization (doing it now).** The single reach-hold was a
   1.2-shaped shortcut; the discriminated union is the foundation every later world
   needs.
2. **Ship "naive/bait" brains as teaching artifacts.** For 1.1 and 1.3, include the
   wrong-but-tempting brain and a test asserting it fails the *documented* way
   (ignored / rejected). Doubles as a regression guard and gives the future UI a
   "here's what goes wrong, and why" panel — the core teaching beat.
3. **Per-level teaching copy + lie surfacing.** Add optional `brief` / `teaches`
   text to `LevelDef` so each level states its lesson and can surface the relevant
   `fidelityNotes` lie in-game. Cheap, high pedagogical payoff.
4. **Brain-model is the real bottleneck (deferred, flagged).** Heartbeats, timed
   racetrack legs, and counter-offer re-sends in the docs all want timers/variables.
   Recommend a minimal **"after N ticks in state" timer trigger** as the next
   brain-model increment — it unlocks World 4.4 and tidier racetracks. Not in this
   batch.
5. **Pars are the Zachtronics hook — set them deliberately.** Tune each level's
   `pars` so the obvious solution passes but the par only falls to the intended
   technique (1.3 `rejections:0` ⇒ read `cap.MaxAltitude`; 1.4 `busTraffic` ⇒
   Direction-only UPDATE). Verify the reference brain hits par in its golden test.

---

## New simplifications to record in `docs/02-fidelity.md` ("lies we tell")

- **1.3 envelope is static** — no fuel burn-off / dynamic republish yet (diverges
  from the doc's dynamic 1.3 design; that needs a fuel model + event schedule).
- **Racetrack flown by position-threshold guards**, not timed legs (no brain timer
  yet).
- **Type Certificate scored worst-of-three via the test harness**, no score-screen
  UI yet.

Also update `docs/03-levels.md` (mark 1.1/1.3/1.4/4.1/4.5 as built, with the
above simplifications) and `docs/06-schemas.md` (objective discriminated union;
`bodies` multi-body field) — per CLAUDE.md "keep docs current."

---

## Files

**Modify (core):** `packages/core/src/level/types.ts`, `level/runtime.ts`,
`world.ts`, `sim.ts`, `score.ts`.
**Modify (levels):** `packages/levels/src/index.ts`,
`packages/levels/worlds/world-1/level-1.2.json` (add `kind`).
**Create (bodies):** `packages/levels/bodies/ax-02.json`, `ax-03.json`.
**Create (levels+brains):** `world-1/level-1.1.json`(+ref +naive),
`world-1/level-1.3.json`(+ref +naive), `world-1/level-1.4.json`(+ref),
`world-4/level-4.1.json`(+ref), `world-4/level-4.5.json`(+locked brain).
**Create (tests):** `packages/levels/test/level-1.1.golden.test.ts`, `1.3`, `1.4`,
`4.1`, `4.5` (+ negative tests for 1.1/1.3).
**Docs:** `docs/02-fidelity.md`, `docs/03-levels.md`, `docs/06-schemas.md`.

---

## Verification (end-to-end)

1. `npm run gen:catalog` — confirm fidelity CI still passes (no catalog change,
   but proves nothing regressed).
2. `npm test` (vitest) — all golden tests pass, including the **unchanged 1.2
   golden** (regression check on the objective refactor) and the 5 new levels.
3. Each new golden test asserts: ref brain `outcome === "won"`, byte-stable log,
   exact MA sends, `scoreWorld(...) === pars`, determinism (two runs identical).
4. Negative tests (1.1, 1.3): the bait/naive brain produces the documented
   `ignored-not-controller` / `REJECTED` disposition and does **not** win.
5. 4.5 test: locked brain wins on `ax-01`, `ax-02`, `ax-03`; `aggregateWorst`
   returns the expected per-metric worst.
