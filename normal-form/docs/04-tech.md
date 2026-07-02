# Technology & Architecture

Recommendation: the sibling stack (Brain Swap / Service Bus conventions), with
**one justified divergence** — the board renders as **SVG/React**, not PixiJS.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) everywhere | one language across sim, UI, tools — sibling convention |
| Build | Vite + npm workspaces | `core` / `levels` / `game` packages, matching `brain-swap/` and `service-bus/` layouts |
| Lint/format | biome | sibling convention |
| Sim core | Pure TS, zero DOM deps | headless deterministic sim + validator; vitest-tested; runs in CI |
| Board rendering | **SVG + React** (divergence) | the board *is* a diagram: lifelines, arrows, text labels, selection boxes, drafting stamps — DOM/SVG's native material. Message-flow motion is transform/opacity animation along a lifeline, comfortably within SVG budget (tens of elements, not thousands). The siblings use PixiJS for *maps* (spatial worlds, trails, many sprites); Normal Form has no map. SVG keeps text crisp at every zoom, makes the Blueprint design's hard-offset shadows and dashed strokes trivial CSS, and keeps hit-testing/drag native |
| UI chrome | React 18 | palette, inspector, validator console, title block — per the Blueprint handoff (`design_handoff_normal_form_blueprint/README.md`), which is the UI/UX spec: recreate the design, do not port its prototype runtime |
| App state | Zustand | thin store bridging sim core ↔ React; sim emits immutable per-tick snapshots (sibling pattern) |
| Tests | vitest + golden runs | level + reference machine → expected outcome/scores, byte-stable |
| Persistence | localStorage + JSON export/import | machines and solutions shareable as files; no backend, static site |

## Package layout

```
normal-form/
  packages/
    core/        # the game's truth — no rendering
      src/bus.ts             # seeded bus: applies a seed's disruption schedule
      src/seeds.ts           # seed schema: reorder/drop/dup/straggle/delay ops
      src/messages/          # catalog: envelope, patterns, enums, citations
      src/validator/         # static CERT validator (compose-time gate)
      src/machine/           # handler-machine schema + interpreter
      src/requestee/         # scripted respondent per level (deterministic)
      src/forge/             # W3 type bench: type model + CERT battery
      src/level/             # level runtime: goals (world-state), win check
      src/score.ts           # messages / machine size / ticks
    levels/      # data only
      worlds/*/sheet-*.json  # goal, palette, seeds, pars, fidelity notes, citations
      catalog/*.yaml         # message catalog source (names, fields, enums, citation)
    game/        # React app
      src/board/             # SVG sequence-diagram board (compose/handlers/run)
      src/panels/            # palette, inspector, validator console, title block
      src/meta/              # level select, debrief, codex, fidelity notes panel
  tools/
    check-fidelity.ts        # greps every catalog name + CERT/RQMT number against
                             # docs/References/*.txt and the XSD; CI gate
```

## Core design decisions

**Determinism is non-negotiable (sibling rule #3).** No RNG anywhere in the sim.
A **seed** is not a PRNG seed — it is an authored disruption *schedule* (data:
`[{at: tick, op: "reorder", …}]`). Same machine + same sheet ⇒ identical message
log, scores, and replay, per seed. This makes golden tests, the failure replay
("here is the tick where your assumption broke"), and step-debugging trivial.

**Determinism/replay model copied from Brain Swap.** A session is a recorded
input script; `replayScript(sheet, script)` reproduces the run headlessly.
Compose/handler edits are the script; RUN takes no input at all (the machine is
data by then), which makes Normal Form's replays even simpler than Brain Swap's.

**The machine is data.** Handlers are JSON: per response-enum rules from a tiny
closed vocabulary (wait / terminal / retry(n) / abort / send(ref)). The
interpreter lives in `core`. Benefits: export/share, machine-size scoring is
structural, and the editor is just a view.

**Pars are sourced from reference machines.** Each sheet ships (test-only, not
bundled) a reference machine; golden tests prove every sheet solvable and derive
pars from the reference's scores — the Brain Swap pattern (`packages/core`
reference brains). A sheet without a passing reference machine cannot ship.

**The validator is a pure function** `validate(sheet, composition) →
Finding[]`, where every `Finding` carries `{code: "USTD-000436" | "SCH-000651" |
"ENV-HeaderType" | …, quote, docRef}`. The same battery runs in the Forge
(SUBMIT) and in compose (gate). Findings render verbatim in the console — error
text is a core mechanic; keep it ≥13px (per the Blueprint handoff).

**The requestee is an engine configured per sheet, not a script per level.** One
respondent implementation consumes a behavior config (which states it reports,
skips, rejects-with-reason, response latencies) — the FA-engine lesson from
Brain Swap. If a sheet needs bespoke respondent code, the sheet is wrong.

**The catalog is generated, and policed.** `catalog/*.yaml` declares each
pattern/message/enum with its citation (document + section + CERT number).
Codegen emits TS types + runtime metadata (inspector field trees, validator
tables). `tools/check-fidelity.ts` greps every name and number against
`docs/References/` — CI fails on inventions, from day one.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| SVG board performance at high run speed | RUN reveals ≤ a few dozen arrows; animate with CSS transforms/opacity only; if a pathological sheet appears, virtualize revealed history. No Pixi fallback needed at this element count |
| Drag-and-drop on a diagram (place primitive spanning lifelines) | native pointer events on SVG + snap-to-lifeline; spike in MVP week 1; fallback is click-palette-then-click-slot (the Blueprint design already reads well that way) |
| Seed vocabulary too weak/too cruel | seeds are data — tune per sheet; golden tests pin the reference machine's pass on every seed |
| Forge (W3) type model scope creep | the bench models only what the cited CERTs police (compositor, base type, naming, ID typing, version attribute); it is not an XSD editor |
| Catalog drift vs the real standard | fidelity CI + citation per catalog entry (sibling mechanism, already proven twice) |
