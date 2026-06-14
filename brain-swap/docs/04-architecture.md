# Technology & Architecture

Decisions confirmed: **visual state machine** brain editor; **React + PixiJS** on a
**pure-TypeScript deterministic simulation core**. No backend — static site,
localStorage saves, shareable brain JSON.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language across sim, UI, tools |
| Build | Vite + npm workspaces | `core` / `levels` / `game` packages |
| Sim core | Pure TS, zero DOM deps | Unit-testable with vitest; runs headless in CI |
| UI | React 18 | Editor panels, message inspector, forms, level select |
| State machine canvas | React Flow (`@xyflow/react`) | Mature MIT node-graph editor; custom node/edge renderers for states/transitions. Saves weeks vs hand-rolling |
| Map rendering | PixiJS v8 | Tactical map: terrain, geozones, routes, curves, aircraft + trail. React overlays for labels/HUD |
| App state | Zustand | Thin store bridging sim core ↔ React; sim emits immutable per-tick snapshots |
| Expressions | Tiny hand-rolled guard/value evaluator | `msg.X == LITERAL`, `var.x`, `cap.MaxAltitude`, arithmetic + clamp. **No eval()**, no general scripting — keeps brains data, keeps determinism |
| Tests | vitest + golden runs | Level + reference brain JSON → expected outcome/scores byte-stable |
| Persistence | localStorage + JSON export/import | Brains and solutions shareable as files |

## Package layout

```
brain-swap/
  packages/
    core/        # the game's truth — no rendering
      src/bus.ts            # in-order message bus, 1-tick delivery
      src/messages/         # message catalog: types + required-field metadata
      src/brain/            # brain JSON schema, interpreter (states/guards/actions)
      src/fa/               # FA engine: validator rules + behaviours, data-driven per body
      src/vehicle/          # point-mass flight model honoring performance profiles
      src/level/            # level runtime: objectives, event schedule, win check
      src/score.ts          # ticks / bus traffic / rejections / brain size
    levels/      # data only
      bodies/*.json         # airframe + FA config (profiles, quirks, validator params)
      worlds/*/level-*.json # objectives, map, available catalog subset, pars, fidelity notes
      catalog/*.yaml        # message catalog source (names, fields, enums, tier)
    game/        # React + Pixi app
      src/editor/           # React Flow canvas, state/transition/send-form panels
      src/run/              # Pixi map, tick controls, message log + inspector, brain highlight
      src/meta/             # level select, score screens, codex, fidelity notes panel
  tools/
    check-fidelity.ts       # greps every catalog name against the real XSD; CI gate
```

## Core design decisions

**Determinism is non-negotiable.** Fixed tick (1 tick = 1 s sim time, rendered at
configurable speed; flight model integrates in fixed sub-steps). No RNG anywhere in
the sim — FA quirks and level events are deterministic schedules in level data.
Same brain + same level ⇒ identical message log, scores, and replay. This makes
golden-run tests, score histograms, and step-debugging trivial.

**The brain is data.** A brain is JSON: states, transitions
(`{trigger: messageType | timer, guard?, actions[], target}`), actions
(`send(messageType, fieldTemplate)`, `set(var, expr)`), plus interaction blocks
(parameterized sub-machines instantiated by reference). The interpreter lives in
`core`. Benefits: export/share, diffing for the world-4 "edit distance" metric,
versioned saves, and the editor is just a view.

**FA is an engine configured per body, not a script per level.** One FA
implementation consumes: a performance profile (the same data advertised in
`MA_FlightCapabilityMT` — FA validates with exactly what it told you, which is the
pedagogical contract), a validator config (geofence/terrain/endurance checks on/off
+ parameters), and a behaviour config (approval latency, PENDING usage, event
schedule for faults/interrupts/revocations). Bodies are therefore data files, and
adding an airframe never means writing new FA logic.

**The message catalog is generated, and policed.** `catalog/*.yaml` declares each
message with its fields (name, type, required-in-which-interaction, enum values)
and a citation (VI Volume table number). A codegen step emits TS types + runtime
metadata (used by send-forms, the inspector, and required-field validation).
`tools/check-fidelity.ts` verifies every message name, field name, and enum literal
appears in the A-GRA XSD. The canonical copy lives at
`../References/A-GRA/standard/Schema/A-GRA_MessageDefinitions_v5_0_a.xsd`; a
byte-identical copy is vendored in-repo at
`docs/A-GRA References/A-GRA_MessageDefinitions_v5_0_a.xsd`, which the check defaults
to (override via `argv[2]`/`FIDELITY_XSD`). CI fails on inventions.

**Sim ↔ UI boundary.** The sim advances only via `step(world): world` on immutable
state; the React app drives it from a rAF loop at the chosen speed and renders
snapshots. Rewind = re-simulate from tick 0 to N (cheap at this scale), which gives
the message-log scrubber for free.

**Message log is the debugger.** Every bus delivery is recorded
`{tick, from, to, type, payload, disposition}` where disposition ∈
delivered / ignored-not-controller / rejected(reason). The inspector renders the
payload as a field tree with required fields flagged and enum values linked to the
codex.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| React Flow fights the editor UX (blocks, edge labels) | Spike it in MVP week 1; fallback is a structured list editor (states as cards) which is uglier but fine — the preview mock in the GDD is essentially that |
| Curve math (quintic Bézier arc-length, curvature checks) | Isolated in `core/vehicle`; world 3 is late; standard fixes the formulation (clamped knots, weight 1) so it's textbook de Casteljau |
| Catalog drift vs real schema | Fidelity CI + citation per catalog entry |
| Scope creep in FA quirks | Quirks only via behaviour config schema; if a level needs bespoke FA code, the level is wrong |
