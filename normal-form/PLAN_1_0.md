# PLAN 1.0 — from MVP to the complete game

Successor to `PLAN_MVP.md` (S1–S6, done) and the MVP review (`REVIEW_MVP.md`,
verdicts filled 2026-07-04). Target: **the full 1.0 — 7 sheets + 1 bonus +
epilogue, one 30–40 minute playthrough** per the rescoped `docs/03-levels.md`.
Scoring is cut; W2/W3/W4 are post-1.0.

**Status (2026-07-16): the build is complete.** Every workstream WS-A…WS-G is
landed on the build side; the only thing left is the human release-gate playtest
(below). This file has been trimmed to that open item — the per-workstream specs
are historical and preserved in git.

## Landed workstreams (WS-A…WS-G)

All 8 sheets (`0-1…0-3`, `1-1…1-4`, bonus `1-5`) are registered in `SHEET_LIST`,
playable in sequence, and golden-proven; each ships a test-only reference machine.

- **WS-A** UI mechanics · **WS-B** 1-1 teaches reliably + scoring removed ·
  **WS-C** registry / progression / persistence · **WS-D** meta screens (welcome,
  How to Play, UCI Reference codex) · **WS-E** World 0 (0-1/0-2/0-3) ·
  **WS-F** World 1 remainder (1-2/1-3/1-4 + bonus 1-5) · **WS-G build side** —
  the A-GRA epilogue debrief (`Epilogue.tsx`) + a static 1024px polish pass.

The standing exit checks are green: `npm test`, `npm run check:types`,
`npm run check:types:game`, `npm run lint`, `npm run check:fidelity`, `vite build`.

## WS-G remaining — the release-gate playtest (user)

The one open item. `REVIEW_1_0.md` is the harness (definition-of-done script +
release bar + a blank verdict table); this is the release gate itself.

- **The playtest:** a real human, no UNIS knowledge, one sitting. Instrument
  nothing — sit with them.
- **Release bar:** completes W0+W1 in ≤40 min and can explain, in the standard's
  terms, (a) why the duplicate ACCEPTED had to be ignored and (b) why a request is
  not a command. **If it overruns 40 min, cut the bonus sheet (1-5), not the
  lessons.**
- **Record** the outcomes in `REVIEW_1_0.md`; **doc edits before any post-1.0
  code** (docs are the source of truth).

**Done when:** the playtest passes the bar and `REVIEW_1_0.md` is filled. At that
point this plan is fully historical — `REVIEW_1_0.md` is the record of record and
`docs/03-levels.md` "Post-1.0" holds the backlog, so `PLAN_1_0.md` can be retired.

## Standing conventions (still apply to any 1.0 fix)

- **Docs are source of truth** — design changes edit `docs/` first, then code.
- **Fidelity gate stays green** — new message/field/enum/citation goes in
  `packages/levels/catalog/uci.yaml` → `gen:catalog` → `check:fidelity`; never
  hand-edit `generated.ts`; the game may omit, never rename or invent.
- **Core stays pure** — no DOM/RNG/wall-clock in `packages/core`.
- **No git add/commit/push** — the user reviews and commits.

## Explicitly out of 1.0

W2 Records, W3 Forge, W4 Program Schema (designs preserved in `docs/03-levels.md`
"Post-1.0"); scoring/pars/histograms; player-authored seeds; touch/mobile; audio;
backend anything.
