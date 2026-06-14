# @brain-swap/game

The React + PixiJS app — the MIL-SPEC Ground Station console (build-order steps 5–7).
It consumes the deterministic headless core (`@brain-swap/core`) and level data
(`@brain-swap/levels`); it never reimplements sim logic.

```bash
npm run dev          # vite dev server (from repo root)
npm run build:game   # production build
npm run typecheck:game
```

## Architecture

- **`sim/timeline.ts`** materializes the whole deterministic run into a `World[]`
  (index === tick). Play / pause / step / scrub are pure index moves into it — the
  docs/04 "rewind = re-simulate from tick 0 to N" contract. The clock (`rAF`,
  `performance.now`) lives only in `App.tsx`; nothing in `packages/core` is touched.
- **`store.ts`** (Zustand) is the single bridge: editable `Brain` (core data) + UI-only
  node `layout`, the timeline, transport/selection state, and localStorage saves
  (brain + layout + best scores) with brain JSON export/import.
- **`ui/Identifier.tsx`** is the only way A-GRA identifiers render (dim affixes, bright
  core, colored enums). **`ui/tokens.ts#badgeFor`** maps core dispositions to the
  semantic badge kinds; caution-yellow/​warning-red are reserved for rejected/revoked.

## Fidelity note (why this differs from the HTML mockups)

The handoff's `design_reference/*.html` hard-code an *invented* failing run with fields
that are **not in the A-GRA XSD** — `FailedFieldPath`, `CapabilityLimit`,
`RequestedValue`, `Altitude.Commanded`, `DestinationID`, `msg.NavigationReportMT.*`,
`cap.MaxSpeed`. Per CLAUDE.md rule #1 and the handoff's own "bind to live sim output…
must not invent message semantics," this app:

- renders inspector/send-form fields **only** from the real catalog
  (`MESSAGE_CATALOG[type].fields`); payloads are flat, so the field tree is flat;
- offers in the CAP palette **only** the keys the brain evaluator resolves
  (`CapabilityID`, `Min/MaxAltitude`, `Min/MaxAirspeed` — see
  `packages/core/src/sim.ts#capContext`), not the mockup's `cap.MaxSpeed` etc.;
- shows `IGNORED — not secondary controller` and `REJECTED · <ValidationResult>` only
  when the player's brain actually earns them (the reference run is a clean win).

No catalog names are added, so the fidelity gate (`npm run fidelity`) is unaffected.
Fonts are linked from Google Fonts for now; self-hosting under `public/fonts/` is a
follow-up (handoff asks for it).
