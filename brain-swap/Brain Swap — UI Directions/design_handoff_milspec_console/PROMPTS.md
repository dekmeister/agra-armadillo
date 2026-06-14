# Claude Code Prompts — Brain Swap MIL-SPEC Console

A sequenced set of copy-paste prompts for building the MIL-SPEC console into the Brain Swap
codebase with Claude Code. **Run them in order** — each builds on the last. Before starting,
make sure this whole `design_handoff_milspec_console/` folder is inside the repo (or paste its
files when a prompt asks for them).

**Before prompt 1**, orient Claude Code with one setup message:

> Read `design_handoff_milspec_console/README.md` in full, then
> `design_handoff_milspec_console/tokens.css`, `tokens.ts`, and skim
> `design_handoff_milspec_console/design_reference/milspec.css` and
> `01-milspec-console.html`. Then summarize back to me: (a) the component inventory for the
> primary console, (b) the semantic color map, (c) which existing modules in THIS repo produce
> the data each panel needs (the message catalog/types, the tick sim, the FA engine output, the
> brain interpreter). Don't write code yet — just confirm the mapping and flag anything in the
> repo that doesn't line up with the data contracts in the README.

Fix any mismatches it finds, then proceed.

---

## Prompt 1 — Tokens, the `Identifier` primitive, and `DispositionBadge`

> Implement the foundation layer for the MIL-SPEC console, matching
> `design_handoff_milspec_console/tokens.css`/`tokens.ts` and the spec in the README.
>
> 1. Wire the design tokens into our styling system (CSS variables / theme object — use whatever
>    this repo already uses; don't introduce a new styling lib). Self-host IBM Plex Mono, Saira
>    Semi Condensed, and Saira Stencil One. **Do not** ship Kalam (that's annotation-only).
> 2. Build the **`Identifier`** component exactly as specified in the README ("Identifier
>    primitive"): splits a long A-GRA identifier into a dim `MA_` prefix, a bright semantic core,
>    and a dim `MT` suffix; an `enumStyle` variant colors enums (`amber`) and failed results
>    (`caution`). This is used everywhere an identifier appears — it is the project's answer to
>    "walls of long monospace identifiers," so make it the only way identifiers are rendered.
> 3. Build **`DispositionBadge`** driven by the `Disposition` contract. Use `dispositionStyle`
>    from `tokens.ts` as the single source of truth. Caution-yellow and warning-red are reserved
>    for `rejected` and `revoked` only — enforce this in the component, not at call sites.
>
> Acceptance: a Storybook/story (or a scratch route) renders `MA_FlightCommandStatusMT`,
> `MA_PositionReportDetailedMT`, and `PERFORMANCE_LIMIT_EXCEEDED` via `Identifier`, and all six
> disposition badges, matching the colors in `01-milspec-console.html`. No identifier is
> truncated. Don't hard-code any hex outside the token files.

---

## Prompt 2 — Console shell: layout, ChromeBar, StatusStrip

> Build the primary console shell from the README "Primary Console → Layout" section. Reference
> `design_reference/01-milspec-console.html` and `milspec.css` for exact structure, but
> implement it in our component framework with real layout (responsive; 1440×900 is the reference
> aspect, not a fixed size).
>
> Build: `ConsoleLayout` (selector strip + chrome bar + status strip + the 3-column grid:
> `468px | 1fr | 386px`, 8px gap, 9px padding), `SecondarySelectorStrip` (as route nav),
> `ChromeBar` (`MissionBlock`, `TickTransport`, `EditRunSwitch`), and `StatusStrip` (`RunLamp` +
> four `MetricReadout`s). Use placeholder boxes for the three big panels for now.
>
> Wire to state per the README "State Management": `TickTransport` and `EditRunSwitch` read/write
> the `sim` slice; `RunLamp` reflects `sim.running`; `MetricReadout`s read `metrics` + `pars` and
> show the over-par alert (Rejections in caution by default). The RUN state must visibly energize
> the RunLamp (green glow) and the active-state highlight hook (used in prompt 6).
>
> Acceptance: the bezel/strip rhythm matches the reference (header 22px, status 30px, chrome
> 58px, square corners, hairline borders). Flipping EDIT/RUN updates the lamp, play button, and
> status text. Don't add rounded corners or drop the 8px grid gap.

---

## Prompt 3 — MessageLog pillar + Inspector  (the heart of the game — do this carefully)

> Build `MessageLogPanel`, `LogRow`, and `InspectorPanel` per the README. Bind them to live bus
> output: subscribe to the `log: LogEntry[]` produced by the FA engine/interpreter each tick.
>
> - `MessageLogPanel` is the **right-hand pillar** and must be full-height and **non-collapsible**
>   — players who hide the log fail the game's premise, so don't add a hide/minimize affordance.
>   Sticky header `TICK | DIR | TYPE · DISPOSITION` (grid `42px 50px 1fr`). Auto-scroll to the
>   newest row while `sim.running`.
> - `LogRow`: zero-padded tick (dim), direction colored by sender (`MA→FA` cyan / `FA→MA` amber),
>   a two-line type cell (message type via `Identifier`, then `DispositionBadge`). Hover tint;
>   selected row = amber left bar + tint. Clicking sets `selectedLogIndex`.
> - `InspectorPanel` mounts at the **bottom of the pillar** (it does not replace the log — the log
>   scrolls above it) when a row is selected. Header = type via `Identifier` + close `✕`;
>   disposition banner (badge + colored reason via `Identifier enumStyle`); then `FieldTree`
>   rendered from the entry's `payload: FieldNode` (recursive, guide lines, `REQ` chips on
>   `required` leaves, `kind:'bad'` in caution, `kind:'enum'/'ref'` in amber/cyan, `note` in olive).
>
> Acceptance: replay the level 1.2 golden run and confirm the sequence renders like
> `01-milspec-console.html`: the `0009` `MA_FlightCommandMT` row shows `IGNORED — not secondary
> controller` (olive), and selecting the `0017` `MA_FlightCommandStatusMT` row opens the inspector
> with `ValidationResult → Result: PERFORMANCE_LIMIT_EXCEEDED` (caution), `FailedFieldPath:
> Altitude.Commanded`, `CapabilityLimit: 12000 ft (= cap.MaxAltitude)`, `RequestedValue: 15500 ft`,
> required fields flagged. No identifier truncated in the inspector. Don't paginate or virtualize
> in a way that breaks auto-scroll (virtualize fine if scroll-to-bottom still works).

---

## Prompt 4 — Tactical map (PixiJS)

> Replace the placeholder map with a real **PixiJS** scene in `TacticalMapPanel`, driven by the
> sim's `world` state (`aircraft`, `trail`, `geofence`, `objectiveZone`, `altitude`). Match the
> reference look in `01-milspec-console.html`: near-black terrain, dashed geofence polygon
> (olive), dashed objective-zone circle (green), aircraft icon + dotted trail (cyan), top-down,
> 2D only. Add the `AltitudeTape` gauge on the right edge (HTML/CSS overlay is fine): labeled
> ticks, an amber `CMD` marker and a green aircraft-altitude marker. Caption `PixiJS · Tactical
> Map` bottom-left.
>
> Keep the Pixi stage sized to the panel body and redrawn from world state each tick; altitude is
> a gauge, never 3D. Use the color tokens for all strokes. Acceptance: the aircraft and trail
> animate across the deterministic run and the altitude markers track commanded vs actual.

---

## Prompt 5 — Brain editor canvas (read + live highlight)

> Build `BrainEditorPanel` with `BrainCanvas`, `StateNode`, `TransitionEdge`, `EdgeChip` per the
> README, bound to `brain: { states, transitions }` and the interpreter's `activeStateId`.
> Render states as 150px square-bordered nodes on a 24px dotted grid; the initial state's dot is
> cyan; the **active state during RUN gets the green border + glow** (driven live by the
> interpreter). Edges are SVG with arrowheads; the fault/revoke edge is a red dashed curve.
> `EdgeChip` shows each trigger via `Identifier` with the guard in amber (red on fault edges).
> Selecting a node/edge sets `selectedStateId`/`selectedTransitionId`.
>
> This prompt is **read + select + live-highlight only** (graph editing comes next). Acceptance:
> the level 1.2 brain renders with the four states and labeled edges matching the reference, and
> during a RUN the active node highlight follows the interpreter step-by-step.

---

## Prompt 6 — Transition form + graph editing

> Build `TransitionForm` (README spec) bound to the selected transition, and add the editing
> affordances from the MVP scope: add/rename/delete states, mark initial, and create a transition
> with one message-type trigger + up to one field guard (`field / operator / value`) and actions
> (`send` / `goto`). The form's three rows are **Trigger** (message type via `Identifier`,
> dropdown from the catalog), **Guard** (field dropdown + operator + value), and **Action**
> (`SEND · <type>` + an `EDIT FIELDS ▸` button that opens the Send-Action Form from prompt 7).
> Show required action fields flagged with a caution `✱`.
>
> Validate edits against the catalog (valid message types, valid guard fields/operators).
> Acceptance: a player can build the level 1.2 brain from blank — add the four states, wire the
> transitions with the `CommandProcessingState == APPROVED` guard, and attach a send action — and
> the interpreter solves the level. Don't let the guard accept fields that don't exist on the
> trigger message type.

---

## Prompt 7 — Send-Action Form modal

> Build the `SendActionForm` modal from `04-send-form.html` and the README. `MessageTypePicker`
> from the catalog; `FieldList` with one row per payload field (name via `Identifier`, `REQ`
> flag, type, and a `LIT | CAP | MSG` value-source segmented control + value box). The three
> sources resolve to: **LIT** literal (amber), **CAP** a `cap.*` body-capability reference (cyan),
> **MSG** a `msg.*` field captured from the triggering message (amber). Right side: two palettes —
> **Body Capabilities** (`cap.*`, bound to the body `CapabilityProfile`) and **Captured Fields**
> (`msg.*`, bound to the selected transition's trigger message) — draggable onto value boxes.
> Footer validation summary + `CANCEL / INSERT ACTION ▸`.
>
> Bind validation to the catalog's required-field + envelope rules: every required field must be
> satisfied and literal/CAP values must be within the advertised envelope before `INSERT ACTION`
> enables. Acceptance: composing the `MA_FlightCommandMT` HSA_CSA payload (DestinationID literal,
> CapabilityID from `cap.HSA.CapabilityID`, Altitude literal, Heading from
> `msg.NavigationReportMT.BearingToZone`) matches the reference and inserts a valid send action
> into the transition.

---

## Prompt 8 — Secondary screens: Compliance Report & Level Select

> Build the two secondary screens in the same visual language.
>
> **ComplianceReport** (`02-compliance-report.html`): `TitleBlock` with the rotated green PASS
> stamp (shown only when every interaction passes), `InteractionResults` table (VI ID · name ·
> PASS/FAIL) bound to the per-interaction validator results, and `MetricHistograms` for the four
> metrics — population distribution bars with the player's bar highlighted (amber, or caution for
> an over-par metric) plus par + percentile. Footer actions: `LEVEL SELECT / RETRY · OPTIMIZE /
> NEXT MISSION`.
>
> **LevelSelect** (`03-level-select.html`): five `World` columns (W0–W4) of `LevelCard`s, each
> with id + name, three metric medals (`T`/`B`/`S` gold/silver/unearned) bound to saved best
> metrics, and a status (cleared / resume / locked) bound to progression. Current level = amber
> ring; the capstone gets the red `◆ Capstone · zero edits` tag.
>
> Acceptance: both screens match the references and read live progression/score data, not the
> hard-coded sample values.

---

## Prompt 9 — Interaction Blocks & the Brain Swap screen (World 4)

> Build the World 4 UI: interaction blocks (reusable composite states) in the editor, and the 
> Brain Swap workflow (re-flying one brain across multiple bodies). These make the game's whole 
> thesis — write against capabilities, not constants, and your brain ports for free — tangible. 
> Stay in the MIL-SPEC language and reuse Identifier, DispositionBadge, the bezel panels, and 
> the tokens. Add these contracts alongside the ones in the README:

```
    // A recurring built interaction (e.g. the control-acquisition handshake) collapsed
    // into one reusable composite state. Instantiated across brains.
    interface InteractionBlock {
      id: string;
      name: string;                 // 'ControlAcquire', 'Heartbeat', 'RouteUpload'
      states: BrainState[];         // the inner sub-machine (same shapes as Brain)
      transitions: Transition[];
      entryStateId: string;
      exitStateIds: string[];       // named exits the outer graph wires to
      params?: { key: string; type: string }[];  // e.g. CapabilityID, target altitude
    }
    // A block placed in a brain renders as a single collapsed node in BrainCanvas.
    interface BlockInstance { id: string; blockId: string; args?: Record<string,string>; }

    // Per-field portability classification, for the swap diff.
    type Binding = 'capability' | 'captured' | 'literal'; // cap.* | msg.* | constant
    interface PortabilityField { path: string; binding: Binding; value: string; portable: boolean; }
    // A single brain flown against a single body.
    interface SwapResult { bodyId: string; bodyName: string; pass: boolean; edits: number; metrics: Metrics; }
```

### Part A — Blocks in the editor (extends Prompt 6).

- Add a "Collapse into block" action: select a connected subgraph in BrainCanvas → create an InteractionBlock, replacing the selection with a single collapsed composite node. Render it distinctly (double-stroke border + a ◧ BLOCK tag in amber, block name in Saira Semi Condensed). Double-click to enter/expand the block (breadcrumb in the panel header: Brain.fsm › ControlAcquire), edit its inner sub-machine, and step back out.
- Add a BlockLibraryPanel (a docked list in the left column, below the editor or as a tab on the BrainEditor header): saved blocks with name, state/transition count, and a small portability dot (green if fully cap.*/msg.*-bound, caution if it hard-codes constants). Drag a block onto the canvas to drop a BlockInstance; if it has params, prompt for args reusing the Send-Action Form's value-source control (LIT | CAP | MSG).
- Block instances contribute to Brain Size as a single unit (reward reuse), not by their expanded node count — reflect this in metrics.brainSize and the StatusStrip.

### Part B — Brain Swap screen (new secondary screen, same chrome as Level Select).

- Header chrome reads BRAIN SWAP · PORT TEST. A left rail picks the source brain; the main area is a multi-body test matrix.
- PortabilityDiff panel: list every value the brain binds, as PortabilityField rows — binding: capability (cyan, ✓ portable), captured (amber, ✓ portable), literal (caution, ⚠ brittle, "won't survive a body swap"). A summary readout: N / M values portable. This is the teaching surface — make the brittle literals obvious.
- SwapMatrix: one column per body (SwapResult), each showing the body name + spec thumbnail, a PASS/FAIL badge (reuse the compliance PASS stamp, smaller), the four metrics, and an edits counter. Re-flying applies the same brain unchanged; any value the player had to change to make a body pass increments edits.
- Capstone variant (4 · CAP One Brain · Three Bodies): three body columns, a hard target of edits = 0, and a celebratory state when the same unedited brain passes all three. Show a single banner: PORTABLE ✓ · 0 EDITS · 3 / 3 BODIES. If any body needed an edit, surface which literal broke it, linked back to its PortabilityDiff row.

### Part C — Robustness (supporting World 4 events). 

> Ensure the log + inspector already handle mid-run FA events from the contracts: revoked disposition
> (warning-red), a TEMPORARILY_UNAVAILABLE status, and heartbeat traffic. Add a thin HeartbeatIndicator 
> to the StatusStrip (a pulsing dot that goes caution→warn if the brain misses its heartbeat cadence) 
> so "heartbeat discipline" is visible without opening the log.
>
> Acceptance: A player can (1) collapse the control-acquisition handshake they built in World 1 into a 
> ControlAcquire block, see Brain Size drop, and drop that same block into a new World 4 brain; (2) open 
> Brain Swap, see the PortabilityDiff flag any hard-coded altitude/speed literal in caution while cap.
> *-bound fields read green; (3) run the capstone and watch one unedited brain pass three bodies with edits 
> = 0, while a brain that hard-codes a constant visibly fails the body whose envelope differs — with the 
> offending literal called out. Don't let a block that hard-codes a constant display a green portability dot.

---

## After the build

- Re-open `01-milspec-console.html` side-by-side with the running app and diff the states: log
  row select → inspector, EDIT vs RUN, active-state highlight, the rejected-row vignette.
- Spot-check the **density discipline** note in the README — this direction is the easiest to
  over-pack. Hold the 8px / 9px / 22px rhythm and the type scale; don't let identifier text drop
  below ~10px.
- Confirm the **two tweaks** survived integration: every identifier renders through `Identifier`
  (dimmed prefix/suffix), and caution-yellow / warning-red appear *only* on rejected / revoked.
