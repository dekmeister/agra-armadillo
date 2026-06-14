# CLAUDE.md — Brain Swap

Zachtronics-style browser puzzle game teaching the A-GRA (ASK 5.0a) Vehicle
Interface. The player builds a Mission Autonomy "brain" (visual state machine)
that exchanges real VI messages with Flight Autonomy, then ports it across
airframes. Design phase is complete; read `docs/` before implementing anything.

## Read first

- `docs/01-game-design.md` — one-page GDD (core loop, scoring, brain model)
- `docs/02-fidelity.md` — message tiers, cuts, and the "lies we tell" list
- `docs/03-levels.md` — level progression and airframe roster
- `docs/04-architecture.md` — stack and package layout
- `docs/05-mvp.md` — MVP scope and 7-step build order (follow this order)

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
- Scoring: Ticks, Bus Traffic, Rejections, Brain Size.
- MVP = level 1.2 "First Valid HSA Command" including the control-acquisition
  handshake; headless golden-run tests prove solvability before any UI.
- Visual design direction (refer to directory: Brain Swap — UI Directions)

## Not yet decided (don't assume)

- Expression syntax details for guards/field values beyond the MVP subset
  (the MVP subset is firmed up in `docs/06-schemas.md`).

> The brain / level / body / catalog JSON schemas were firmed up in build-order
> steps 1–4 and are documented in `docs/06-schemas.md`; the TypeScript types in
> `packages/core/src` are the source of truth.

## Conventions

- Cite the VI Volume table/section in catalog entries and in code comments only
  where a behavior is non-obvious spec compliance (e.g. "DEACTIVATE fails while
  EXECUTING, VI Vol §1.2.5.4").
- Keep docs current: when implementation forces a design change, update the
  relevant `docs/` file in the same change.
