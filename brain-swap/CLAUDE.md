# CLAUDE.md — Brain Swap

Zachtronics-style browser puzzle game teaching the A-GRA (ASK 5.0a) Vehicle
Interface. The player builds a Mission Autonomy "brain" (visual state machine)
that exchanges real VI messages with Flight Autonomy, then ports it across
airframes. **Current state:** the MVP and a post-MVP batch have shipped — a
playable React+Pixi game (`npm run dev`) with levels **1.1, 1.2, 1.3, 1.4, 4.1,
4.5** and bodies **AX-01/02/03**, each level golden-tested. Read `docs/` before
implementing; `docs/03-levels.md` has the authoritative per-level build status.

## Read first

- `docs/01-game-design.md` — one-page GDD (core loop, scoring, brain model)
- `docs/02-fidelity.md` — message tiers, cuts, and the "lies we tell" list
- `docs/03-levels.md` — level progression, airframe roster, and **build status**
- `docs/04-architecture.md` — stack and package layout
- `docs/05-mvp.md` — original MVP build order (shipped; historical record)
- `docs/06-schemas.md` — catalog / body / level / brain JSON schemas (current)

## Hard rules

1. **Never invent standard names.** Every message type, field name, and enum
   literal shown to the player must exist in the real schema. Canonical copy:
   `../References/A-GRA/standard/Schema/A-GRA_MessageDefinitions_v5_0_a.xsd`.
   A byte-identical copy is vendored in-repo at
   `docs/A-GRA References/A-GRA_MessageDefinitions_v5_0_a.xsd`; the fidelity CI
   defaults to that copy (override with `argv[2]`/`FIDELITY_XSD`).
   Verify by grepping the XSD before adding anything to the message catalog.
   The fidelity CI script (`tools/check-fidelity.ts`, build-order step 1)
   enforces this.
2. **Simplifications are recorded, never silent.** Any divergence from the
   standard goes in the "lies we tell" section of `docs/02-fidelity.md`.
3. **The sim core stays deterministic and headless.** No RNG, no DOM, no
   wall-clock time in `packages/core`. Same brain + same level must produce an
   identical message log every run.
4. **Spec questions go to the source, not memory.** Primary source is
   `../References/A-GRA/standard/Documentation/ASK 5.0a Vehicle Interface Volume.pdf`
   (135 pp). Extract with `pdftotext -layout <pdf> /tmp/vi.txt` and grep;
   §1.2 has the interactions, §1.3.1 the minimum message set, §1.3.2 the
   MA_* extension field tables. Don't try to read whole ICD/compliance PDFs —
   they are hundreds of pages.

## Locked decisions (don't re-litigate without the user)

- Brain = visual state machine; reusable "interaction blocks" later.
- Stack: TypeScript (strict), Vite, npm workspaces (`core` / `levels` / `game`),
  React 18 + React Flow for the editor, PixiJS v8 for the map, Zustand, vitest.
  No backend; localStorage saves.
- Scoring: Ticks, Bus Traffic, Rejections, Brain Size (`aggregateWorst` reduces
  multi-body runs to the per-metric worst — used by 4.5).
- Every playable level ships with a hand-written reference brain and a byte-stable
  golden-run test that proves solvability headless (the original MVP discipline,
  now applied to each level).
- Objectives are a discriminated union (`reach-hold` / `hold-control` /
  `waypoint-sequence`); a level may override the body's vehicle `start`. See
  `docs/06-schemas.md`.
- Visual design direction (refer to directory: Brain Swap — UI Directions)

## Not yet decided (don't assume)

- Expression syntax details for guards/field values beyond the MVP subset
  (the MVP subset is firmed up in `docs/06-schemas.md`).

> The brain / level / body / catalog JSON schemas were firmed up in build-order
> steps 1–4 and are documented in `docs/06-schemas.md`; the TypeScript types in
> `packages/core/src` are the source of truth.

## Adding a level

Levels are **data**, not code, when they reuse the existing engine. Prefer that
path; only touch `packages/core` when the level genuinely needs a new mechanic.

1. **Stay fidelity-clean.** Reuse the existing 9-message catalog if possible. If a
   level truly needs a new message/field/enum, add it to `packages/levels/catalog/`,
   run `npm run gen:catalog` + `npm run fidelity` (every name must grep in the XSD),
   and record any simplification in `docs/02-fidelity.md` (+ add a `FidelityNote` in
   `packages/game/src/meta/fidelityNotes.ts`, kept in sync).
2. **Author the data** under `packages/levels/worlds/world-N/`:
   `level-X.Y.json` (objective `kind`, `body`, `capabilityId`, `availableMessages`,
   `maxTicks`, optional `brief`/`teaches`/`start`/`bodies`, `fidelityNotes`) plus a
   `*.reference-brain.json` and any `*.naive-brain.json` / `*.locked-brain.json`.
   New airframes go in `packages/levels/bodies/*.json`.
3. **Register** in `packages/levels/src/index.ts`: export the level + brains, add any
   body to the `BODIES` map, and add the level to the `LEVELS` registry. Add it to
   the map in `tools/dump-log.ts` too.
4. **Tune by running it.** `npx tsx tools/dump-log.ts <levelKey> <ref|naive|locked>`
   prints the projected log, MA sends, final state, and score. Set `pars` to the
   measured winning run. (For multi-body levels, co-design body envelopes so the
   locked brain's commanded values sit inside every body's common envelope.)
5. **Golden test** in `packages/levels/test/` mirroring `level-1.2.golden.test.ts`:
   `outcome === "won"`, byte-stable log, exact MA sends, `scoreWorld === pars`,
   determinism; plus negative tests asserting bait/naive brains fail the *documented*
   way (`ignored-not-controller` / `REJECTED`). Long logs: pin length + a hash (see
   `level-1.4.golden.test.ts`).
6. **Make it playable:** flip `playable: true` for that id in
   `packages/game/src/meta/levelCatalog.ts` (the store/registry wiring does the rest).
7. **A genuinely new objective kind** means extending the union in
   `packages/core/src/level/types.ts`, teaching `evaluateWin`
   (`level/runtime.ts`), and narrowing any UI that reads `objective.*`
   (`packages/game/src/run/MissionPanels.tsx`, `TacticalMap.tsx`).
8. **Verify:** `npm run typecheck && npm run typecheck:game && npm run fidelity &&
   npm test`. Keep `docs/03-levels.md` build status current.

## Conventions

- Cite the VI Volume table/section in catalog entries and in code comments only
  where a behavior is non-obvious spec compliance (e.g. "DEACTIVATE fails while
  EXECUTING, VI Vol §1.2.5.4").
- Keep docs current: when implementation forces a design change, update the
  relevant `docs/` file in the same change.
