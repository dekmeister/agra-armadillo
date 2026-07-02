# Normal Form — MVP Build Plan

Build the MVP defined in `docs/05-mvp.md`: **sheet 1-1 "First Acknowledgement",
playable end-to-end in the browser** — compose (with the two scripted validator
beats), handlers, run against 3 seeds, score vs pars. The MVP is a **review
checkpoint**: once it plays, we stop, play it, and tweak the design docs and the
game before building the rest. Nothing beyond the checkpoint is built until that
review happens.

Six sessions, each sized for a single Claude Code session, each ending in a
verifiable state. Later sessions start cold — every session begins by reading
the **Session inputs** below plus its own entry-state note.

## Session inputs (read at the start of every session)

- `docs/01-game-design.md` … `docs/05-mvp.md` — the design pack. `05-mvp.md` is
  the MVP contract (fields, seeds, pars, validator battery V1–V10, JSON sketch).
- `design_handoff_normal_form_blueprint/README.md` — the UI spec (exact hex
  values, band heights, column widths, typography). **Recreate the design in
  React; do not port `support.js`** (the handoff says so explicitly). Open
  `Normal Form - Blueprint.dc.html` in a browser when building UI sessions.
- `docs/References/` — the four UCI sources. The fidelity rule is mechanical:
  every message/field/enum name and CERT/RQMT number in code must grep-match
  these files.
- Sibling conventions: `../brain-swap/docs/04-architecture.md` (package shape,
  determinism rules, golden-test pattern).

## Ground rules (all sessions)

1. **Determinism.** No RNG, no wall-clock in `packages/core`. Seeds are authored
   disruption schedules (data). Same machine + same sheet ⇒ byte-identical logs.
2. **Fidelity CI from the first commit.** `tools/check-fidelity.ts` gates the
   build; unknown names/numbers fail. Never rename, never invent.
3. **Headless first.** Core is provably correct (golden tests) before any UI
   exists — the Brain Swap build order, which worked twice.
4. **The reference machine is test-only.** It sources pars and proves
   solvability; it is never bundled into the game.
5. **Corrections already decided** (see `docs/02-fidelity.md` §3): -2 responses
   use `RequestProcessingStateEnum` (MVP only needs `CommandProcessingStateEnum`,
   but don't wire the wrong enum into shared code); the mock's `SCH-000164`
   stamp is a placeholder — missing SystemID renders as `ENV HeaderType — …`.
6. Commit at the end of each session (working tree green: tsc, biome, vitest,
   fidelity CI).

## Sessions

### S1 — Scaffold + catalog + fidelity CI

*Entry:* design docs only, no code.
*Build:*
- npm-workspaces monorepo per `docs/04-tech.md`: `packages/core`,
  `packages/levels`, `packages/game` (Vite + React 18 + TS strict), `tools/`,
  vitest, biome. Match sibling configs (`../brain-swap`, `../service-bus`)
  rather than inventing new ones.
- Message catalog (`packages/levels/catalog/*.yaml` → codegen or hand TS to
  start): envelope (`MessageType`/`HeaderType` fields), `TaskCommand` /
  `TaskCommandStatus`, `CommandStateEnum`, `CommandProcessingStateEnum`,
  `MessageModeEnum`, each entry carrying its citation (doc + section + CERT).
- `tools/check-fidelity.ts`: extract every name + CERT/RQMT number from the
  catalog and grep `docs/References/*.txt` + the XSD; wire into an npm script
  (`npm run check:fidelity`) alongside `check:types`, `lint`, `test`.
*Verify:* all four scripts green; fidelity check demonstrably *fails* on a
planted fake name (test the gate, then remove the plant).
*Exit:* empty-but-green monorepo; catalog policed.

### S2 — Core sim, headless (the game is provably solvable)

*Entry:* S1 committed.
*Build in `packages/core`:*
- `seeds.ts` + `bus.ts`: disruption ops **reorder / dup / delay** (drop and
  straggle-as-op are post-MVP; seed ③'s "duplicate after terminal" is `dup`).
- `requestee/`: the scripted-respondent engine, config-driven per
  `docs/05-mvp.md` (`onCommand: RECEIVED at +2, ACCEPTED at +4 → activity`).
- `machine/`: handler-machine JSON schema + interpreter (rules: wait / terminal
  / retry(n) — retry unused in 1-1 but in the vocabulary), correlation by
  `CommandID`, **terminal-state rule enforced** (post-terminal deliveries
  ignored; acting on one is a fault signal).
- `level/`: sheet runtime — world-state win check (`activityExecuted` +
  machine terminal), tick loop, per-seed run, all-seeds gate.
- `score.ts`: messages / machine size / ticks (worst seed).
- Sheet 1-1 as data in `packages/levels` per the JSON sketch in `05-mvp.md`.
*Verify (golden tests, the heart of the MVP):*
- Reference machine (hand-written JSON, test-only) **passes all 3 seeds**;
  scores match pars (2 · 3 · ≤6).
- Negative goldens: a machine that hard-sequences RECEIVED→ACCEPTED **fails
  seed ② only**; a machine whose ACCEPTED rule isn't terminal **fails seed ③
  only**; logs are byte-stable across repeated runs.
*Exit:* `vitest` proves sheet 1-1 solvable and the seeds teach what
`docs/03-levels.md` says they teach — before any UI exists.

### S3 — Static validator (the compose gate)

*Entry:* S2 committed.
*Build:* `core/validator/` — pure function `validate(sheet, composition) →
Finding[]`, battery **V1–V10** from `docs/05-mvp.md`, each `Finding` carrying
`{code, verbatim quote, docRef}`. Real UUID checks (Leach-Salz variant / nil,
canonical string form) for V5/V6. Findings' quoted text comes from the catalog
(policed by fidelity CI), not string literals scattered in code.
*Verify:* unit tests per rule — both scripted beats produce exactly the two
findings from the mock (with the corrected `ENV HeaderType` code, not
`SCH-000164`); a fully-corrected composition returns `[]`; property-style tests
on the UUID validators (valid v1/v4, nil, wrong variant, non-canonical form).
*Exit:* the gate exists and quotes the standard verbatim.

### S4 — Board + run view (watch the reference machine play)

*Entry:* S3 committed. This is the first UI session — have the Blueprint
prototype open for comparison.
*Build in `packages/game`:*
- Screen chrome per the handoff: header band, goal/metrics sub-bar, palette
  (Command-2 active, five locked), inspector shell, validator console shell,
  title block. Exact tokens from the handoff README (colors, band heights
  52/46/flex/154, columns 236/flex/348, JetBrains Mono + Architects Daughter).
- **SVG sequence-diagram board**: lifelines at 36%/74%, time ruler, message
  arrows colored by state enum, reveal-per-tick animation.
- RUN phase wired to the **real engine** (not the mock's scripted reveals):
  Zustand store drives `step()`, run controls PLAY/PAUSE/STEP/RESET at
  250–1500 ms, seed strip with per-seed status, metric pills live, goal stamp
  on pass.
- Dev affordance: load the reference machine behind a `?ref=1` flag so the run
  view is drivable before editing exists (flag stripped in S5).
*Verify:* headless screenshot of each phase tab vs the prototype (same
deep-link + screenshot approach as the service-bus memory note); manual visual
diff against `Normal Form - Blueprint.dc.html`; the run is deterministic —
two PLAY runs of seed ② produce identical frame sequences; tsc/biome/vitest
still green.
*Exit:* you can *watch* 1-1 being solved, tick by tick, in the shipped visual
language.

### S5 — Compose + handlers editing (the game becomes playable)

*Entry:* S4 committed.
*Build:*
- COMPOSE: place Command-2 from the palette (drag with snap-to-lifeline;
  fallback if drag fights us: click-palette-then-click-slot — the handoff reads
  fine that way, decide in-session and note it), arrow selection, envelope
  inspector editing for the two editable fields, live validator console,
  RUN-blocked gating (`2 ERRORS · RUN BLOCKED` badge → `READY`).
- HANDLERS: the handler widget — per-enum rule rows (RECEIVED/ACCEPTED/REJECTED
  wired, CANCELED legend-only), machine-size readout.
- Phase switching semantics per the handoff (switching resets tick, stops
  playback).
- Remove the `?ref=1` reference-machine path from the bundle (test-only again).
- Session recording: player actions as a replayable script
  (`replayScript(sheet, script)` headless — the Brain Swap property), and a
  golden test that replays a recorded solve to the same outcome/scores.
*Verify:* end-to-end playtest following the **definition-of-done script** from
`docs/05-mvp.md`: blocked by validator → fix both fields → wire handlers →
seed ② kills a naive machine → fix → all seeds pass. Use the `/run` skill /
browser to actually drive it; capture screenshots of the failure moment and the
pass. Golden replay test green.
*Exit:* a newcomer-playable 1-1 from broken initial state to pass.

### S6 — Polish the lesson + review package

*Entry:* S5 committed.
*Build:*
- **Failure replay**: on a seed failure, scrub to the offending tick and quote
  the violated CERT text (terminal-state rule for seed ③, ordering for ②).
- **Fidelity Notes panel** for 1-1 (lies #1/#2/#5/#9 from `docs/02-fidelity.md`).
- Score panel vs pars on pass (in-screen overlay is enough — no separate
  debrief screen in MVP).
- Red drafting stamp, disposition polish, enum legend links (codex stubs OK).
- **`REVIEW_MVP.md`**: the review checkpoint doc — a play-this-first checklist
  (the definition-of-done script), the questions the review should answer
  (Is the seed difficulty curve right? Does the validator text teach or nag?
  Is the handler vocabulary too small? Board readability at 1024px?), and a
  place to capture verdicts that feed doc tweaks before any post-MVP session.
*Verify:* full battery green (types, lint, tests, fidelity, golden replays);
run the definition-of-done on a real human if available, otherwise record a
complete playthrough; screenshots archived for the review.
*Exit:* **MVP done — stop building.** Next session is the review, not World 0.

## The review checkpoint (after S6, before anything else)

Play the MVP against `REVIEW_MVP.md`. Expected outputs: (a) verdicts + tweak
list, (b) edits to `docs/01–05` where the design changed on contact with play,
(c) a re-scoped plan for the next tranche (World 0 + rest of World 1). Design
docs are updated *before* new code — the docs stay the source of truth.

## Out of scope for the MVP (deferred, tracked here)

**Game content** — everything except sheet 1-1:
- Worlds 0, 2, 3, 4 and W1 sheets 1-2…1-6 (`docs/03-levels.md`).
- Seed ops `drop` and scheduled `straggle` (W0/1-3 need them; MVP needs only
  reorder/dup/delay).
- Reject-configured requestee, retry-as-NEW enforcement, request patterns +
  `RequestProcessingStateEnum` (1-4/1-5/1-6).
- Multi-consumer fan-out, found-message ghost lifeline, composed -3 patterns,
  `DataRecordInstanceID` correlation (W0/W2).
- **The Forge type bench** (W3) — a whole separate board mode.
- Message Set palette-cost economy, forged-type import (W4).

**Screens** (mocked in `DESIGN_PROMPT.md` but not designed in the handoff):
- Level select (five worlds) — MVP boots straight into 1-1.
- Post-level score/debrief screen — MVP uses an in-screen score overlay.
- A-GRA bridge/epilogue debrief; the full codex ("In the real standard…" —
  stubs only in MVP).

**Platform / meta:**
- Save slots, solution export/import, localStorage persistence beyond the
  in-progress sheet.
- Score histograms / population stats.
- Portrait & sub-1024px layouts (the handoff explicitly designs landscape
  ≥1024 only), touch-first interactions, accessibility pass beyond semantic
  HTML + focus states (do the real pass post-review).
- Sound, music, juice beyond the handoff's specified animations.
- Deployment/hosting (static-site build must work — `vite build` in CI — but
  publishing is post-review).
- Player-authored seeds, adversary mode, stretch sheets (`docs/03-levels.md`).

**Known debts accepted into the MVP** (call out in review):
- Handler vocabulary is the minimum honest set (wait/terminal/retry) — expect
  the review to pressure-test whether it stays fun through W1.
- `SchemaVersion`/`Timestamp` are prefilled-valid, not exercised — envelope
  literacy is W0's job, and W0 doesn't exist yet.
- Only `CommandProcessingStateEnum` handling is real; the shared enum plumbing
  for request patterns is a seam, not an implementation.
