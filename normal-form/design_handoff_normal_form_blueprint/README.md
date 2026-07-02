# Handoff: Normal Form — "Blueprint" Puzzle Screen

## Overview
**Normal Form** is a single-player, browser-based, Zachtronics-style puzzle game (SpaceChem / TIS-100 lineage). The player is an "integration engineer" certifying message interactions between abstract software components using a real, public military messaging standard (UCI). There is no fiction, no map — the standard's own notation (sequence diagrams) *is* the game board.

This handoff covers the **main puzzle screen** in the **"Blueprint" visual direction** — the diagram presented as an engineering drawing: drafting ink on vellum, dimension ticks, zone-coded panels, red drafting stamps for errors, and a title block. It is one of four explored directions and the one selected for development.

The screen runs the game's three-phase core loop on a single screen, switched by tabs:
1. **COMPOSE** — place interaction primitives on a sequence-diagram board and fill in each message's envelope fields; a static validator blocks running with spec-style errors.
2. **HANDLERS** — attach a small reactive state machine to the response messages.
3. **RUN** — play the interaction tick-by-tick against a set of adversarial "seeds"; win = goal reached on every seed.

The concrete level mocked is **"1-1 First Acknowledgement"** (World: *One Way*).

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that shows the intended look, layout, color system, and interaction behavior. **They are not production code to copy directly.**

The `.dc.html` files use a small in-house prototyping runtime (`support.js`, a template + logic-class component model). **Do not port that runtime.** Your task is to **recreate this design in the target codebase's own environment** (React, Vue, Svelte, SwiftUI, etc.) using its established patterns, component library, and state management. If no codebase exists yet, choose the most appropriate framework for a rich, interactive game UI (React or Svelte both fit well) and implement there.

To view the prototype: open `Normal Form — Blueprint.dc.html` in a browser (it loads `support.js` from the same folder). `Normal Form UI.dc.html` is the four-direction exploration, included for context only.

## Fidelity
**High-fidelity (hifi) for the visual treatment.** Colors, typography, spacing, the color-coding system, and the interaction model are all final and intentional — recreate them precisely (exact hex values and measurements are listed below).

Two caveats to keep in mind:
- The underlying **game logic is stubbed** — the RUN animation reveals pre-scripted messages on a timer; the validator errors are hard-coded; the "seeds" don't actually execute. Implement the real puzzle engine per the game design; use this screen only as the UI/UX spec.
- It targets **desktop and tablet in landscape only** (see Responsive Behavior). No portrait / phone layout is designed.

## Screens / Views
There is **one screen** with three phase states (COMPOSE / HANDLERS / RUN). The chrome (header, sub-bar, palette, board frame, inspector shell, console shell, title block) is identical across phases; only the board contents, the inspector body, and the validator/console body change.

### Screen: Main Puzzle Screen
- **Purpose**: The player composes a message interaction, wires response handlers, then runs it against adversarial seeds to certify it.
- **Overall layout**: Full-viewport vertical flex stack, `min-width: 1024px`, `height: 100dvh` (`min-height: 640px`), `overflow: hidden`. Font: `'JetBrains Mono', monospace` throughout, with `'Architects Daughter', cursive` reserved for the "hand-annotation" accents (goal line, marginalia).
  1. **Header band** — 52px tall, full width, `background:#24435f`, text `#f3efe4`.
  2. **Goal + metrics sub-bar** — 46px tall, `background:#e9e2d1`, bottom border `1.5px solid #24435f`.
  3. **Main row** — `flex:1`, three columns: Palette (236px) · Board (flex) · Inspector (348px).
  4. **Bottom row** — 154px tall, two columns: Validator/Console (flex) · Title block (348px). Top border `1.5px solid #24435f`.

#### Component: Header band
- Left cluster (baseline-aligned, gap 14px):
  - `NORMAL FORM` — 15px / weight 800, letter-spacing .04em.
  - `SEQUENCE CERTIFICATION` — 12px / 500, opacity .65, letter-spacing .05em.
  - Sheet chip: `SHEET 1-1 · First Acknowledgement` — 11px / 700, border `1px solid rgba(243,239,228,.4)`, padding 2×9px, radius 2px.
- Right cluster — three phase-tab buttons, gap 5px. Each: padding 6×15px, 11px / 700, letter-spacing .05em, radius 2px, border `1px solid rgba(243,239,228,.35)`, idle background `rgba(243,239,228,.1)`, text `#f3efe4`. Labels: `1 · COMPOSE`, `2 · HANDLERS`, `3 · RUN`.
  - **Active tab**: `background:#c07d1f; border-color:#c07d1f; color:#24435f;` (amber fill, ink text).

#### Component: Goal + metrics sub-bar
- Left: `GOAL` badge (`background:#24435f`, text `#f3efe4`, 10px/800, padding 3×8px, radius 2px, letter-spacing .08em) + goal text `SystemB performs the tasked activity; you hold proof.` in **Architects Daughter 15px**, `#24435f`, single-line ellipsis.
- Right cluster (gap 8px):
  - Three **metric pills**, each a bordered rounded (3px) row with a solid-color label cap + value: `MSG 2/2` (color `#2f8f5b`), `SIZE 3/3` (color `#1f8a6d`), `TICK {tick}/6` (color `#c07d1f`; value turns amber `#c07d1f` while playing, else ink `#24435f`). Label caps are 9px/700 white-on-color; values 12px/700; the `/N` denominator is opacity .5.
  - 1px vertical divider (24px tall, `rgba(36,67,95,.3)`).
  - **Run controls**: `▶ PLAY` (toggles to `❚❚ PAUSE`) — solid `#24435f`, text `#f3efe4`, padding 6×13px, radius 3px. `STEP` and `RESET` — outline `1.5px solid #24435f`, ink text, padding 6×11px, radius 3px. All 11px/700.

#### Component: Palette (left column, 236px)
- `background:#efe7d5`, right border `1.5px dashed #24435f`.
- Zone header row: 9×9px square swatch `#2f6fb0` + `PALETTE` label (12px/800, letter-spacing .07em). Bottom border `1.5px solid #24435f`.
- Two grouped lists, each with a centered divider-rule heading:
  - **ONE-WAY** (heading color `#2f6fb0`): `Status-1`, `Data-1`, `DataRecord-1` — all **locked**.
  - **SEND · RESPOND** (heading color `#1f8a6d`): `DataRequest-2`, `ActionRequest-2` — locked; `Command-2` — **active**.
- **Locked primitive chip**: row, gap 8px, `border:1px dashed rgba(36,67,95,.4)`, left accent `3px solid` (group color — blue `#2f6fb0` for one-way, teal `#1f8a6d` for send·respond), padding 6×8px, `opacity:.55`. Contains a circled index (①–⑤), the name (12px/500), and a `LOCK` tag (8px/700).
- **Active primitive chip (Command-2)**: `background:#fbeccb`, `border:2px solid #c07d1f`, left accent `5px solid #c07d1f`, box-shadow `2px 2px 0 rgba(192,125,31,.25)`, padding 7×8px. Contains a 7px amber dot, `Command-2` (13px/800), and a `READY` tag (8px/700, `#c07d1f`).
- Footer note (Architects Daughter 12px, `rgba(36,67,95,.6)`, dashed top border): "Only Command-2 is unlocked this sheet. Drag it onto a lifeline to place its arrow pair."

#### Component: Board / sequence diagram (center, hero — flex)
This is the visual centerpiece and must never be crowded out.
- `background:#f6f2e8` with a **32px engineering grid**: two `repeating-linear-gradient`s (0deg and 90deg), line `rgba(36,67,95,.05)` at 31→32px.
- Zone label (top-left, gap 7px): 9px ink square + `DIAGRAM` (12px/800) + "sequence · Commander ⇄ Commandee" (Architects Daughter 12px, muted).
- **Time ruler** (left edge, ~22px wide): `t0`…`t6`, 10px/700, `rgba(36,67,95,.5)`, distributed top-to-bottom (`justify-content:space-between`).
- **Lifelines**: two, at **36%** and **74%** of board width.
  - Headers: bordered boxes (`2px solid #24435f`, `background:#e9e2d1`, padding 6×18px, 13px/800, box-shadow `2px 2px 0 rgba(36,67,95,.2)`). Left: `Commander (you)` — the "(you)" in amber `#c07d1f`. Right: `Commandee (SystemB)` — "(SystemB)" at opacity .6.
  - Vertical lifelines: `2px dashed rgba(36,67,95,.55)`, running from below the headers to near the bottom.
- **Message arrows** (connectors): positioned `left:36%; width:38%` (spanning between the two lifelines). Each has a label sitting just above the line, a 2.5px top border for the shaft, and a triangle glyph (`▶` for left→right requests, `◀` for right→left responses) at the arrow end.
  - Request `TaskCommand →`: color `#2f6fb0` (blue), solid.
  - Response arrows are colored by their state enum (see tokens): `RECEIVED` `#3b6ea5`, `ACCEPTED` `#2f8f5b` (3px shaft, has a ✔), unset placeholder is `rgba(36,67,95,.5)` **dashed**.
- **Board contents by phase**:
  - **COMPOSE**: `TaskCommand →` shown *selected* — wrapped in a dashed amber selection box (`1.5px dashed #c07d1f`, `background:rgba(192,125,31,.06)`) with a `◄ SEL` tag (9px/800 amber). Below it, the response `← TaskCommandStatus ⟨unset⟩` as a muted dashed placeholder. Plus a **red drafting stamp** (see below).
  - **HANDLERS**: same two arrows, plus a **handler widget** centered on the Commander lifeline: bordered box (`2px solid #24435f`, `background:#efe7d5`, box-shadow `3px 3px 0 rgba(36,67,95,.2)`, width 300px, 11px/700 line-height 1.85). Title row `Δ HANDLER` / `on TaskCommandStatus` (amber). Four rules, each enum in its color: `RECEIVED → wait`, `ACCEPTED → terminal ✔`, `REJECTED → resend (max 1)`, `CANCELED → abort`.
  - **RUN**: three equal-height tracks, each revealing its connector as the tick advances — `TaskCommand →` (tick ≥ 1), `← RECEIVED` (tick ≥ 3), `← ACCEPTED ✔` (tick ≥ 5). At tick ≥ 6, a rotated green **"✔ GOAL REACHED · seed ① pass"** stamp (`3px solid #2f8f5b`, `background:rgba(47,143,91,.08)`, 15px/800).
- **Red drafting stamp (failure moment, COMPOSE only)**: `✖ REJECTED · SCH-000164` — positioned top-right of the board's open area, `transform:rotate(-9deg)`, `border:3px solid #b23a2e`, color `#b23a2e`, `background:rgba(178,58,46,.08)`, padding 6×13px, 15px/800, letter-spacing .05em.

#### Component: Inspector (right column, 348px)
- `background:#e8edf0`, left border `1.5px dashed #24435f`.
- Zone header: 9px teal square `#1f8a6d` + `INSPECTOR` (12px/800) + "TaskCommand" (Architects Daughter 12px, muted, right-aligned).
- **Body by phase**:
  - **COMPOSE — Envelope fields**: section label `ENVELOPE FIELDS` (10px/700, letter-spacing .08em, muted). Field rows (12px/600):
    - `SystemID` — **error**: `background:#f7dcd7`, `border:1.5px solid #c0392b`, red text, value `✖ ⟨required⟩`.
    - `Timestamp` — valid: white bg, `border:1px solid rgba(36,67,95,.25)`, left accent `3px solid #2f8f5b`, `✓`. Sub-value line `2026-07-02T09:14:03Z` (11px, muted, indented).
    - `SchemaVersion` — valid, value `002.5`.
    - `Mode` — valid, value `LIVE` (green 800).
    - `CommandID` — **error** block: red field with `✖ not UUID` and the invalid value `f81d4fae-7dec-11d0-a765-00a0zzz` (10px, word-break).
  - **HANDLERS — Handler rules**: `HANDLER RULES · on TaskCommandStatus` label; four rows, white bg with left accent in each enum's color, `ENUM → action`. Below: a note box (`1px solid #24435f`, `background:#e9e2d1`, Architects Daughter 12px): "Machine size **3** states — matches par."
  - **RUN — Seed schedule**: `SEED SCHEDULE` label; three seed rows (white bg, left accent `4px solid` seed-status color, 12px/700): status glyph + index + description. Seeds: ① `in-order`, ② `ACCEPTED before RECEIVED`, ③ `duplicate after terminal`.
- **State-enum legend (persistent, pinned to bottom via `margin-top:auto`)**: `STATE ENUMS` label (dashed top border) + four pills, each `1.5px solid` + text in the enum color, with a matching dot: `RECEIVED` `#3b6ea5`, `ACCEPTED` `#2f8f5b`, `REJECTED` `#c0392b`, `CANCELED` `#c9962b`.

#### Component: Validator / Console (bottom-left, flex)
- `background:#faf6ec`.
- Header row: 9px red square `#b23a2e` + `VALIDATOR` (12px/800) + a status badge (pill, 10px/800, white text):
  - COMPOSE → `2 ERRORS · RUN BLOCKED` on `#c0392b`.
  - HANDLERS → `0 ERRORS · READY` on `#2f8f5b`.
  - RUN → `RUNNING · SEED ①` on `#24435f`.
- Body (13.5px/700, line-height 1.95):
  - **COMPOSE (failure moment)**: two red error lines, each with an inline tag chip (`CERT` / `RQMT`, white-on-`#c0392b`):
    - `✖ CERT SCH-000164 — MessageHeader missing required SystemID`
    - `✖ RQMT USTD-000436 — CommandID is not a valid RFC-4122 UUID`
    - `▸ fix both fields in the inspector to unblock RUN.` (muted).
  - **HANDLERS**: green `✔ 0 blocking errors · 4 handler rules wired · machine size 3/3` + muted hint.
  - **RUN**: ink `▸ tick {tick} · bus policy: IN-ORDER` + a line showing `RECEIVED → ACCEPTED` in their enum colors.
- Error/console text must stay comfortably readable — it is a core mechanic (players study it). Keep ≥13px.

#### Component: Title block (bottom-right, 348px)
- `background:#e9e2d1`, left border `1.5px solid #24435f`, laid out as a 2-column grid of drafting-style cells (labels 9px/600 muted, values 800 ink).
- Zone header: 9px amber square `#c07d1f` + `TITLE BLOCK`.
- Cells: `SHEET 1-1` · `WORLD One Way` · `DRAWN BY sys-alpha-01` · `SCALE 1 tick : 1 msg`.
- Full-width `PAR` row: `2 msg` (green) · `3 size` (teal) · `≤6 ticks` (amber).

## Interactions & Behavior
- **Phase switching**: clicking a header tab (or the run controls) sets the phase. Switching phases **resets tick to 0** and stops playback. Active tab gets the amber fill.
- **RUN playback**:
  - `▶ PLAY` starts a timer that increments `tick` by 1 on each interval until `tick === 6`, then stops and flips the button back to `▶ PLAY`. While running the label is `❚❚ PAUSE`; clicking it pauses (stops the timer, keeps tick).
  - `STEP` advances one tick (clamped 0–6). `RESET` sets tick to 0 and stops playback.
  - Interval duration is the `runSpeed` setting: **default 750ms**, range 250–1500ms.
  - Message reveal thresholds: `TaskCommand` at tick ≥ 1, `RECEIVED` at tick ≥ 3, `ACCEPTED` at tick ≥ 5, goal-reached at tick ≥ 6. (These are placeholder scripted reveals; replace with real engine output.)
- **Validator gating**: in COMPOSE the two errors are present and RUN is conceptually blocked (badge says `RUN BLOCKED`). In the real game, RUN should be disabled until the envelope validates.
- **Responsive behavior**: fluid width, **landscape only**, `min-width: 1024px` (iPad landscape and up). Panel columns are fixed widths (236 / 348 / 348px); the board absorbs remaining width. Vertical layout is fixed-height bands (52 / 46 / flex / 154px) that fit within `min-height: 640px` (works at 1024×768). No portrait or sub-1024 layout exists — design one if phones are in scope.
- No hover states are specified beyond buttons being clickable; add codebase-standard focus/hover affordances.

## State Management
Minimal UI state for this screen:
- `phase`: `'compose' | 'handlers' | 'run'` — default `'compose'`.
- `tick`: integer 0–6 — default 0.
- `playing`: boolean — default false.
- One timer/interval handle for playback (clear on unmount, on phase change, on reset, and when tick reaches 6).

Everything else on screen (envelope field values, validity, handler rules, seed definitions, par values) is **level data** that should come from the puzzle definition, and RUN output should come from the **puzzle engine** — not hard-coded as in the prototype. Derived-from-tick display values in RUN: which arrows are visible, seed ① status (running → pass at tick 6), and the metric readouts.

## Design Tokens

### Colors — surfaces
| Token | Hex | Use |
|---|---|---|
| desk | `#dcd6c7` | page behind the screen |
| vellum | `#f3efe4` | root background |
| board | `#f6f2e8` | diagram surface (32px grid `rgba(36,67,95,.05)`) |
| panel-warm | `#efe7d5` | palette background, handler widget |
| panel-cool | `#e8edf0` | inspector background |
| console | `#faf6ec` | validator background |
| chrome | `#e9e2d1` | header band-adjacent, title block, lifeline headers |
| ink | `#24435f` | primary line/text, header band, diagram zone |

### Colors — zone / category accents
| Token | Hex | Use |
|---|---|---|
| palette / one-way | `#2f6fb0` | palette zone dot, one-way group, request arrow |
| inspector / send·respond | `#1f8a6d` | inspector zone dot, send·respond group, SIZE metric |
| validator / stamp | `#b23a2e` | validator zone dot, red drafting stamp |
| accent / active | `#c07d1f` | Command-2 active, TICK metric, title-block zone, active tab, "(you)" |
| accent-fill | `#fbeccb` | active Command-2 chip background |

### Colors — state enums (must read distinctly at a glance)
| Enum | Hex |
|---|---|
| RECEIVED | `#3b6ea5` |
| ACCEPTED | `#2f8f5b` |
| REJECTED | `#c0392b` |
| CANCELED | `#c9962b` |

### Colors — status / validation
| Token | Hex | Use |
|---|---|---|
| pass | `#2f8f5b` | seed pass, MSG metric, valid field accent, goal stamp |
| fail / error | `#c0392b` | error fields, error text, error badge |
| error-bg | `#f7dcd7` | invalid field background |
| run/active seed | `#3b6ea5` | seed currently running |
| wait/muted seed | `#9a9384` | pending seed |

### Typography
- Primary: **JetBrains Mono** — weights 400, 500, 700, 800. Used for all UI, labels, values, code/spec text.
- Accent: **Architects Daughter** (cursive) — the goal line, palette footer, marginalia notes only.
- Scale (px): zone/section labels 10–12 (700/800, letter-spacing .07–.08em); body/values 12–13.5; console 13.5 (line-height 1.95); header title 15/800; goal 15 (Architects Daughter); tags 8–11.

### Spacing / geometry
- Band heights: header 52, sub-bar 46, bottom 154.
- Column widths: palette 236, inspector 348, title block 348 (board = remaining).
- Root: `min-width:1024`, `height:100dvh`, `min-height:640`, `overflow:hidden`.
- Radii: 2px (chips/tags/tabs), 3px (metric pills, control buttons), 10px (status badges).
- Borders: structural dividers `1.5px solid #24435f`; palette/inspector edges `1.5px dashed #24435f`; lifelines `2px dashed rgba(36,67,95,.55)`.
- Signature shadow: hard offset drafting shadow `2px 2px 0` / `3px 3px 0` in the element's ink/accent at ~.2 alpha (no blur).
- Lifelines at 36% / 74%; message connectors `left:36%; width:38%`.

## Assets
None. There are **no images or icon assets** — all iconography is Unicode glyphs (`▶ ◀ ✔ ✖ ❚❚ ▸ ◄ Δ ⇄` and circled numerals `① ② ③ ④ ⑤`). Both fonts load from Google Fonts (JetBrains Mono, Architects Daughter); substitute your codebase's equivalents if self-hosting. No brand assets are used.

## Files
- `Normal Form — Blueprint.dc.html` — **the design to implement.** Template markup + a logic class; open in a browser to interact.
- `support.js` — the prototyping runtime the file depends on. **Reference only — do not port.**
- `Normal Form UI.dc.html` — the original four-direction exploration (Blueprint / IDE-debugger / Paper-spec / Oscilloscope). Context only; direction 1a is the one built out here.
- `DESIGN_PROMPT.md` — the full game design brief (mechanics, palette names, level data, all screens). Read this for the game's intent and for the other screens not yet designed (score/debrief, level select, type bench).
