# PLAN 1.0 — from MVP to the complete game

Successor to `PLAN_MVP.md` (S1–S6, done) and the MVP review (`REVIEW_MVP.md`,
verdicts filled 2026-07-04). Target: **the full 1.0 — 7 sheets + 1 bonus +
epilogue, one 30–40 minute playthrough** per the rescoped `docs/03-levels.md`.
Scoring is cut; W2/W3/W4 are post-1.0.

## How to use this plan

Each **workstream (WS-A…WS-G)** is sized for one focused Claude Code session
and is independently shippable. Run them in dependency order; parallel where
marked. Every session starts by reading, in order:

1. `CLAUDE.md` (repo conventions — fidelity gate, determinism, ESM/strict TS)
2. `docs/01-game-design.md` + the doc(s) named in the workstream
3. This file's entry for the workstream

Non-negotiables for every session:

- **Docs are source of truth.** If implementation forces a design change, edit
  `docs/` in the same session, before the code.
- **Fidelity gate stays green.** Any new message/field/enum/citation goes in
  `packages/levels/catalog/uci.yaml` → `npm run gen:catalog` → `npm run
  check:fidelity`. Never hand-edit `generated.ts`. The game may omit; it may
  never rename or invent.
- **Core stays pure.** No DOM/RNG/wall-clock in `packages/core`.
- **Exit checks:** `npm test`, `npm run check:types`, `npm run
  check:types:game`, `npm run lint`, `npm run check:fidelity` — all green.
- **No git add/commit/push** — the user reviews and commits.
- A sheet ships only with a passing test-only reference machine + golden test.

Dependency graph:

```
WS-A (in flight) ──► WS-B ──► WS-C ──┬──► WS-E ──┐
                                     ├──► WS-F ──┼──► WS-G
                                     └──► WS-D ──┘   (playtest + release)
```

(WS-D/E/F can run in parallel once WS-C lands; WS-E and WS-F only share the
sheet-unlock ordering data.)

---

## WS-A — UI mechanics round *(IN FLIGHT in a separate session — do not start)*

Already underway elsewhere: stack the three phases vertically (kill the header
tabs), a generate button for `CommandID` UUIDs, full arrow-motion sequencing on
RUN. Later workstreams touching `packages/game` must land **after** this to
avoid conflicts, and should re-read the changed layout before editing.

## WS-B — Make 1-1 teach reliably; remove scoring

*The review-verdict fixes (`REVIEW_MVP.md`) + amendments 1–4 in `docs/05-mvp.md`.
All in `packages/game` + small `core`/`levels` touches. Depends on WS-A.*

- **Gate pre-checked.** 1-1's session starts with `gateAccepted: true`, framed
  in the UI as an inherited "sequential handler template" — seed ② failure is
  guaranteed. Consider generalizing the checkbox into a per-rule "only after X"
  qualifier (machine schema + interpreter already close); if deferred to WS-F,
  say so in the code.
- **V10 → readiness state.** Compose console reads clean once fields are fixed;
  missing terminal handlers render as an amber `HANDLERS NOT READY` badge (still
  blocks RUN). Split the finding channel accordingly.
- **Run event log.** Replace the static `RECEIVED → ACCEPTED` console line with
  a per-tick log: delivery, machine reaction (incl. "gated, waiting for
  RECEIVED"), world-state changes. This is what makes the seed-② hang legible.
- **RUN ALL.** One button runs all seeds headless (engine is pure — `useRun`
  already computes this), lights the seed strip ✔/✖; click a seed to watch it.
- **Scoring removal.** Delete metric pills, PAR row, score-vs-par in the
  CERTIFIED overlay and machine-size par text; drop `pars` from sheet JSON +
  level types; remove `core/src/score.ts` and its exports (knip will confirm).
  CERTIFIED overlay shows the sheet's **recap line** (new sheet field, see
  `03-levels.md`) instead of metrics.
- Update project `CLAUDE.md` (it documents score.ts and pars) and
  `REVIEW_MVP.md` known-debts where now stale.

**Done when:** the definition-of-done script in `REVIEW_MVP.md` plays with the
new flow — a naive player *must* fail seed ② and ③ before certifying — and no
scoring surface remains.

## WS-C — Level infrastructure (registry, flow, persistence) *(LANDED)*

*The gating refactor for all content work. `packages/levels` + `game`. Depends
on WS-B (shared files).*

**Done:** `@normal-form/levels` now exports an id-ordered registry
(`SHEET_LIST` / `getSheet` / `nextSheetId` / `FIRST_SHEET_ID`); the game reads the
current sheet from the Zustand store (no component imports `sheet_1_1`); a
`select` drawing-index screen (`SheetSelect.tsx`) drives play with predecessor-
certified unlock; `persist.ts` saves `{certified, scripts, lastSheet}` to
localStorage with JSON export/import and replay-based restore. A second registered
sheet (`sheet-1-2`, an infrastructure **stub** — WS-F replaces it with the real
1-2) proves the pipeline generalizes; it ships a reference machine + golden.
Seed-count/`clampSeed`/circled-glyph and the "TaskCommand" header are all
de-hardcoded (`sheet.ts` derives per-sheet bits). Save schema documented in
`docs/04-tech.md`; `CLAUDE.md` updated.

- **De-hardcode `sheet_1_1`.** Every game component currently imports it
  directly (`Board`/`Inspector`/`SubBar`/`Palette`/`Header`/`TitleBlock`/
  `ValidatorConsole`/`store`). Introduce a sheet registry in `@normal-form/levels`
  (id-ordered list + loader) and a `currentSheet` in the store; components read
  from the store. Also un-hardcode seed-count assumptions (`clampSeed`,
  `CIRCLED` arrays) and the inspector's "TaskCommand" header.
- **Progression flow.** Sheet-select screen (Blueprint "drawing index" styling
  fits) + CERTIFIED → next-sheet unlock; sheets list locked/certified state.
- **Persistence.** localStorage: per-sheet action `script` (already recorded
  per edit) + certified flags; restore on load; JSON export/import per
  `docs/04-tech.md`. The welcome card (WS-D) keys off "no save exists".

**Done when:** two registered sheets (1-1 + a stub) can be played in sequence
with unlock + reload-restore, all goldens green.

## WS-D — Meta screens: welcome card, How to Play, UCI Reference *(LANDED)*

**Done:** the three player-facing surfaces ship as store-driven overlays
(`overlay` field on the Zustand store; `WelcomeCard`/`HowToPlay`/`UciReference`
rendered in `App.tsx` after the screen ternary). The welcome card shows first
visit only (`persist.hasSave`, never over a deep-linked view). The UCI Reference
is the full 8-section codex: curated prose (overview, six patterns w/ SVG
mini-diagrams, A-GRA bridge) authored in a new `reference:` section of
`catalog/uci.yaml` and **fidelity-policed** (its CERT numbers, `names:` XSD
identifiers, and verbatim quotes now grep-check in `tools/fidelity.ts`; a fake
number/name/misquote fails `check:fidelity` — verified); catalog-bound tables
(envelope, enums, concrete messages) render straight from `generated.ts`.
Entry points: header `▤ UCI REFERENCE` / `? HOW TO PLAY`, the same two on the
drawing index, locked+active palette chips deep-link to `pat-<name>`, and the
inspector enum popover gains a `→ full entry` link to `enum-<name>`.

*Docs `06-how-to-play.md` and `07-uci-reference.md` are the specs — copy lives
there; port, don't rewrite. Depends on WS-C (header/nav + save detection);
parallel with WS-E/F.*

- **Welcome card** (first visit, no save) and **HOW TO PLAY** screen — copy
  verbatim from `06-how-to-play.md`.
- **UCI REFERENCE** codex per `07-uci-reference.md`: catalog-bound layer
  rendered from `generated.ts`; curated layer authored in a new `reference`
  section of `catalog/uci.yaml` so `check-fidelity.ts` polices its names,
  numbers, and quotes (extend the gate to walk that section).
- Header gains `▤ UCI REFERENCE` + `? HOW TO PLAY`; inspector enum popovers and
  palette chips (incl. locked chips) deep-link into the reference.

**Done when:** a player can, without leaving the game, read what UCI is, what
each pattern is for, and every enum/message the game uses — with citations —
and the fidelity gate fails on an invented name in the reference YAML.

## WS-E — World 0 (sheets 0-1, 0-2, 0-3) ← built

*New engine capabilities + three sheets, per `docs/03-levels.md` W0. `core` +
`levels` + `game`. Depends on WS-C. Delivered in three sub-stages: E1 (engine
foundation, goldens-only) → E2 (0-1 & 0-2 playable) → E3 (0-3 + filed-finding).
All three W0 sheets are registered, playable, and golden-proven; the deterministic
playtest lives in `packages/game/test/w0-play.test.ts`. The one remaining manual
QA is the interactive browser walk-through (`npm run dev`, ≥1024px). Fan-out
label readability at 3–4 lifelines is the deferred item for WS-G (REVIEW_MVP Q4).*

- **Engine:** `drop` seed op — **net-new** (the `SeedOp` union is the closed set
  `reorder | dup | delay`; `drop` was only a header comment, so this adds a
  `DropOp` arm + an exhaustive `applyOp` case — the first op that *removes* a
  pending); a generalized seeded bus + goal evaluator (`Goal.win` was dead data —
  `runSeed` hardcoded the goal); a **parallel one-way producer sim path** (Status-1/
  Data-1 have no response enum and are terminal-on-send — the artifact is a publish
  plan, not a reactive machine); multi-consumer fan-out for -1 patterns (0-2 has
  three consumer lifelines — board must render 2–4 lifelines from sheet data);
  world-state goals "console shows status by tick N" (deadline) / "datum held
  continuously t6–t12" (continuous interval, with a `staleAfter` staleness rule —
  see `docs/03-levels.md` 0-2 and `docs/02-fidelity.md` §2).
- **Catalog:** concrete Status-1/Data-1 message bindings + citations (pick real
  XSD global elements; verify with the fidelity gate before building on them).
- **The "wrong palette" finding (0-3):** the one novel UI affordance in 1.0 —
  filing a finding as the pass condition. Prototype early in the session;
  design note into `03-levels.md` if the interaction changes.
- Three reference machines + goldens; per-sheet fidelity notes + recap lines.

**Done:** 0-1→0-3 registered and playable, each arriving broken per the
"lesson guaranteed" rule; goldens + fidelity green; standing exit checks green.

## WS-F — World 1 remainder (1-2, 1-3, 1-4, bonus 1-5) *(STAGED: 1-2 + 1-3 landed; 1-4/1-5 → `PROMPT.md`)*

**Staged (2026-07-12).** WS-F is really four sub-stages of escalating engine work.
**1-2 and 1-3 are built, green, and registered** this session (`core` + `levels`
only); **1-4 and bonus 1-5** — which add the request-pattern enums, the enum-driven
handler machine + game UI, a two-job runtime, and the mid-run CANCEL surface — are
handed off with a full design + file map in **`PROMPT.md`** at repo root.

Landed this session:
- **1-2 "Skipping the Pleasantries"** (replaces the WS-C stub) — RECEIVED is a
  courtesy; the pre-checked gate + **per-seed commandee variants** (`Seed.requestee`,
  a spec-legal behaviour variant, not a `-1` drop) guarantee the seed-② lesson.
- **1-3 "Rejection Letter"** — REJECTED kills the CommandID; the new **reactive
  retry loop** (`runSeed` now consumes the interpreter's `outbound`, has the
  commandee respond to the fresh NEW command, retires the old id, budget-bounded) +
  the **reject engine** (`RequesteeConfig.rejects` with a real `CannotComplyEnum`
  reason) recover it.
- Catalog gains `CannotComplyEnum` + the real `CommandProcessingStateReason` field;
  `docs/03-levels.md` 1-2/1-3 and `docs/02-fidelity.md` §2 updated (docs-first).
- Proofs: `sheet-1-2`/`sheet-1-3` goldens + `packages/game/test/w1-play.test.ts`
  (player-path certification). Standing exit checks green; `vite build` clean.

*Per rescoped `docs/03-levels.md` W1 (note renumbering: old 1-4/1-5/1-6 → new
1-3/1-4/1-5; old 1-3 folded into 1-1). `core` + `levels` (+ `game` for 1-4/1-5).
Depends on WS-C; parallel with WS-E.*

- **1-2 Skipping the Pleasantries:** needs nothing new beyond requestee configs
  that skip RECEIVED / go straight to REJECTED — and the per-rule "only after
  X" qualifier if WS-B deferred it (it's this sheet's footgun).
- **1-3 Rejection Letter:** reject-configured requestee (`CannotComplyType`
  reason from the catalog), retry-as-NEW enforcement (fresh UUID; UPDATE to a
  dead CommandID ignored → timeout), retry budget as sheet data (fidelity lie
  #5 surfaced in that sheet's notes).
- **1-4 Request Is Not Command:** DataRequest-2/ActionRequest-2 patterns +
  `RequestStateEnum`/`RequestProcessingStateEnum` plumbing (declared seam in
  the machine/interpreter); two-job sheets (two goals, two placed primitives);
  pattern-choice consequences per the sheet spec.
- **1-5 Cancel Culture (bonus, skippable in the flow):** CANCEL as player
  action mid-run; the race seed with the "whichever outcome" goal variant.
- Reference machines + goldens for all four; recap lines; fidelity notes.

**Done when:** full W1 playable; a wrong pattern choice on 1-4 visibly
dead-ends its job's world-state; goldens + fidelity green.

## WS-G — Epilogue, polish, playtest (release gate)

*Depends on everything above.*

- **Epilogue debrief** screen: the collected recap lines as a checklist + the
  A-GRA bridge table (render from the same data the UCI Reference uses), with
  the "now play the sentences" pointer to the sibling games.
- **Polish sweep:** 1024px readability check on every sheet (arrow-label
  collisions at dense ticks were flagged unverified in the review); focus/
  keyboard pass; empty-state and error-state copy; consistent stamps.
- **The playtest:** a real human, no UNIS knowledge, one sitting. Instrument
  nothing — sit with them. **Release bar:** completes W0+W1 in ≤40 min and can
  explain, in the standard's terms, (a) why the duplicate ACCEPTED had to be
  ignored and (b) why a request is not a command. If it overruns, cut the
  bonus sheet, not the lessons.
- Record playtest outcomes in a `REVIEW_1_0.md` (same pattern as
  `REVIEW_MVP.md`); doc edits before any post-1.0 code.

**Done when:** the playtest passes the bar and `REVIEW_1_0.md` is filled.

---

## Explicitly out of 1.0

W2 Records, W3 Forge, W4 Program Schema (designs preserved in `03-levels.md`
"Post-1.0"); scoring/pars/histograms; player-authored seeds; touch/mobile;
audio; backend anything.
