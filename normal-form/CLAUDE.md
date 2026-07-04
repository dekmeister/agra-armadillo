# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Normal Form** — a Zachtronics-style browser puzzle game (SpaceChem / TIS-100 mould)
where you certify interactions between abstract **UCI Components** by composing
sequence diagrams, wiring reactive handler machines, and surviving a hostile
message bus. It is the "grammar course" in the A-GRA suite (siblings: Brain Swap,
Service Bus).

**The design docs are the source of truth, updated before code** (`REVIEW_MVP.md`).
Read them before making design-affecting changes:
- `docs/01-game-design.md` — the one-page game design (core loop, worlds; no scoring — pass/fail)
- `docs/02-fidelity.md` — **the honesty contract** (see "Fidelity" below)
- `docs/03-levels.md` — the 1.0 sheet lineup (W0 + W1 + epilogue; W2–W4 are post-1.0)
- `docs/04-tech.md` — architecture and stack rationale
- `docs/05-mvp.md` — the MVP sheet 1-1 spec, as built + post-review amendments
- `docs/06-how-to-play.md` / `docs/07-uci-reference.md` — meta-screen specs and player-facing copy
- `PLAN_1_0.md` — the workstream plan (WS-A…WS-G, one per session) / `REVIEW_MVP.md` — review verdicts

Current state: the MVP (sheet 1-1 "First Acknowledgement") is complete and playable
end-to-end; the MVP review verdicts are in. Work proceeds by `PLAN_1_0.md`
workstreams (WS-A UI mechanics is in flight in a separate session).

## Commands

```bash
npm run dev              # run the game (Vite) — @normal-form/game, open at ≥1024px wide
npm test                 # vitest run (all packages + tools)
npx vitest run packages/core/test/validator.test.ts   # a single test file
npx vitest run -t "seed"                               # tests matching a name

npm run check:types      # typecheck core + levels + tools (tsconfig.json)
npm run check:types:game # typecheck the game package separately (has DOM libs)
npm run lint             # biome check .
npm run lint:fix         # biome check --write .
npm run knip             # unused files/exports/deps

npm run gen:catalog      # regenerate messages/generated.ts from the YAML catalog
npm run check:fidelity   # THE fidelity gate — see below
```

Note: `check:types` and `check:types:game` are **separate** because the game uses
DOM libs and JSX while core/levels/tools are DOM-free. Run both after cross-cutting
changes. There is no combined typecheck script.

## Fidelity — the load-bearing constraint

Every game object must trace to the public UCI 2.5 standard. **The game may omit;
it may never rename or invent.** This is mechanically enforced:

- `npm run check:fidelity` (`tools/check-fidelity.ts`) extracts every message name,
  field, enum literal, and CERT/RQMT number from the catalog and greps them against
  the real spec sources in `docs/UCI References/` (three `.txt` specs + the XSD).
  Unknown names or misquoted numbers fail the build. This must stay green.
- When adding any message/field/enum/citation, add it to
  `packages/levels/catalog/uci.yaml` with its citation, run `gen:catalog`, then
  `check:fidelity`. Never hand-edit `packages/core/src/messages/generated.ts` —
  it is generated and committed.
- Simplifications are allowed but must be **disclosed**: `docs/02-fidelity.md` §3
  ("Lies we tell") lists each one, and levels surface the relevant subset in an
  in-game Fidelity Notes panel. If you simplify, document it there.

## Architecture

npm workspaces monorepo, TypeScript strict everywhere. Three packages + a tools dir.

```
packages/core/    # the game's deterministic truth — NO DOM, NO RNG, NO wall-clock
packages/levels/  # data only: the YAML catalog, sheet JSON, level loader
packages/game/    # React 18 + SVG app (the one Blueprint screen)
tools/            # catalog codegen + the fidelity CI gate
```

Note: the actual `core/src` layout is flatter than the aspirational tree in
`docs/04-tech.md` (e.g. `messages/`, `validator/`, `machine/`, `level/`,
`requestee/`, `session/` exist; `forge/`, `board/`, `panels/` are post-MVP).

### Core data-flow (packages/core)

The sim is a pipeline of pure functions. Same sheet + same machine + same seed ⇒
**byte-identical** run log (the determinism rule — enables golden tests and the
failure replay):

1. `requestee/` — a scripted respondent *engine* configured per sheet (which
   states it reports, when, rejects-with-reason). One implementation, config-driven;
   never bespoke code per level. Produces `Emission`s.
2. `seeds.ts` — a **seed is an authored disruption schedule** (data: `reorder` /
   `dup` / `delay` ops drawn from spec-legal transport misbehavior), NOT a PRNG seed.
3. `bus.ts` — `scheduleDeliveries(emissions, seed)` applies the schedule, turning
   emissions into an ordered list of `Delivery`s.
4. `machine/` — the handler machine is **data** (JSON): per-enum rules from a tiny
   closed vocabulary (`wait` / `terminal` / `retry`). `interpreter.ts` reacts to
   deliveries; `schema.ts` defines the shape and `machineSize` scoring.
5. `level/runtime.ts` — `runSeed(sheet, machine, seed)` ties it together and judges
   the goal by **world-state** ("the activity executed AND machine reached terminal"),
   never "message sent".
6. `validator/` — `validate(sheet, composition) → Finding[]`, a pure compose-time
   gate. Each `Finding` carries a `{code, quote, docRef}`; the verbatim CERT/RQMT
   text is a core game mechanic (error prefixes `ENV` / `CERT SCH` / `CERT UNIS`
   stay distinct — see fidelity lie #11).
7. `session/` — the player's editable work as a headless `Session`; edits fold in
   via `applyAction` and record into a replayable script.
8. `score.ts` — the three Zachtronics metrics: messages / machine size / ticks.

### Reference machines & pars

Each sheet ships a **test-only** reference machine (in `packages/core/test/`, never
bundled in `levels`) that golden tests prove passes all seeds. Pars are derived from
its scores. A sheet with no passing reference machine cannot ship. Golden JSON lives
in `packages/core/test/reference/`.

### Game (packages/game)

One screen (`App.tsx`): header · sub-bar · [palette · board · inspector] · [console
· title block]. Three phases (compose / handlers / run) share identical chrome —
only the bodies change. State: **Zustand** store (`store.ts`) wraps a core `Session`;
derived data (validator findings, wired machine, playback) lives in the `use*.ts`
hooks. The board is **SVG, not PixiJS** (deliberate divergence from siblings — the
board *is* a sequence diagram; see `docs/04-tech.md`). Styling is inline via design
tokens in `tokens.ts` (the "Blueprint" drafting-on-vellum aesthetic).

## Conventions

- ESM only (`"type": "module"`), `.ts`/`.tsx` import extensions required
  (`allowImportingTsExtensions`), `verbatimModuleSyntax` (use `import type`).
- Strict TS incl. `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`.
- Biome for lint/format: 2-space indent, 100 col, double quotes, trailing commas,
  semicolons. `generated.ts` and `docs/UCI References/` are excluded.
- Core is headless and pure — introducing DOM, RNG, `Date.now()`, or any nondeterminism
  into `packages/core` breaks the golden tests and the replay guarantee. Don't.
