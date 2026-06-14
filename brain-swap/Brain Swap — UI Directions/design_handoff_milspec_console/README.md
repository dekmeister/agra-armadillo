# Handoff: Brain Swap — MIL-SPEC Ground Station Console

## Overview

This package is the developer handoff for **Brain Swap's primary game UI** — the puzzle
workspace where the player builds a Mission Autonomy (MA) "brain" (a visual state machine),
runs the fixed-tick simulation, and reads the A-GRA Vehicle Interface message traffic to
understand why the Flight Autonomy (FA) accepted, ignored, or rejected each command.

The chosen visual direction is **MIL-SPEC Ground Station**: a dense, MIL-STD-1472-flavored
avionics console — olive / amber / cyan on near-black, square bezels, stenciled labels, and
**alert colors used strictly semantically**. It was selected because the UI *is* the subject
matter (a real USAF avionics standard), its alert palette makes the message log scannable at
a glance (the whole point of the game), and its dense layout holds three heavyweight panels
with the **message log as a permanent right-hand pillar** that the player can never hide.

This package covers the **primary console** plus three **secondary screens** (Compliance Test
Report, Level Select, Send-Action Form), all in the same visual language.

---

## About the Design Files

The files in `design_reference/` are **design references created in HTML** — prototypes that
show intended look and behavior. **They are not production code to copy directly.**

Your task is to **recreate these designs inside Brain Swap's existing environment**
(React + PixiJS, per the game design docs) using its established patterns: the message
catalog/codegen types, the deterministic tick simulation, the FA engine output, and the
brain interpreter. The HTML uses vanilla DOM + inline SVG and a hand-rolled scale-to-fit; the
real app should use your component framework, your state store, and PixiJS for the map.

Where the HTML hard-codes example data (the level 1.2 "First Valid HSA Command" golden run),
the real components must **bind to live simulation output** via the data contracts in this
README.

### The two tweaks adopted over the raw mockup

The recommendation was MIL-SPEC **with two changes** — both are already reflected in the specs
below and must be implemented:

1. **`<Identifier>` token primitive (borrowed from the Modern IDE direction).** Every long
   message/field identifier (`MA_FlightCommandStatusMT`, `PERFORMANCE_LIMIT_EXCEEDED`) renders
   through one component that **dims the `MA_` prefix and `MT` suffix, foregrounds the semantic
   core, and colors enums**. This is the single most important legibility primitive — it solves
   "walls of long monospace identifiers" everywhere they appear (log, inspector, edges, forms).
   See **Design Tokens → Identifier primitive**.

2. **Alert colors stay strictly semantic — never decorative.** Caution-yellow means *rejected*,
   warning-red means *revoked/fault*, and nothing else may use them. This keeps the log a
   reliable instrument. See **Design Tokens → Semantic color map**.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, density, and interaction model are
specified to the pixel here. Recreate the look faithfully using your component library — these
are not loose wireframes. The one element rendered loosely is the **tactical map**, which is a
striped placeholder standing in for a **PixiJS** render; build it for real in Pixi against the
sim's world state.

---

## Screens / Views

### 1. Primary Console  (`01-milspec-console.html`)

The puzzle workspace. **This is the screen that must ship first and look right.**

**Layout** — a vertical stack inside a 1440×900 design frame (the app should be fluid/responsive;
1440×900 is the reference aspect, not a hard size):

```
┌ secondary-screen selector strip (26px) ───────────────────────────────┐
├ ChromeBar (58px): MissionBlock | TickTransport | EditRunSwitch ────────┤
├ StatusStrip (30px): RunLamp ........................ MetricReadout ×4 ──┤
├ Grid (fills rest), 3 columns: 468px | 1fr | 386px, 8px gap, 9px pad ────┤
│  ┌ LEFT col ──────┐ ┌ CENTER col ─────────┐ ┌ RIGHT col (LOG PILLAR) ─┐ │
│  │ BrainEditor    │ │ TacticalMap (PixiJS) │ │ MessageLog (fills)      │ │
│  │  (flex:1)      │ │  (flex:1)            │ │  + Inspector (drops in  │ │
│  │ ────────────── │ │ ─────────────────── │ │    from bottom on row    │ │
│  │ TransitionForm │ │ MissionCard │ Spec   │ │    select)              │ │
│  │  (auto height) │ │  (1fr 1fr, auto h.)  │ │                          │ │
│  └────────────────┘ └─────────────────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

**Components**

- **SecondarySelectorStrip** — 26px tall, near-black (`--k-bezel`). Left: stenciled brand
  `BRAIN SWAP · GS-1` (Saira Stencil One, `--k-amber`, with a glowing amber square). Then nav
  links `Console / Test Report / Level Select / Send Form` (Saira Semi Condensed 600, 12px,
  uppercase, `.08em` tracking). Active link = amber fill, black text. Right meta: dim
  `A-GRA VI · ASK 5.0a · MIL-SPEC GROUND STATION`. In-app this becomes route navigation.

- **ChromeBar** (58px) — three regions separated by 1px `--k-line` dividers:
  - **MissionBlock** (min 330px): line 1 = `MSN 1.2` (amber) + ` · FIRST VALID HSA COMMAND`
    (Saira Semi Condensed 700, 13px, `--k-phos`); line 2 = dim 10px body/profile/authority.
  - **TickTransport**: play/pause button (30px square; when running, green fill, `❚❚` glyph),
    step button (`⏭`), speed segmented control `1× / 2× / 8×` (active = amber fill black text),
    then `TICK 0017` (label `--k-dim`, number `--k-green` 600).
  - **EditRunSwitch** (right-aligned): two-segment hard switch `EDIT | RUN`. Active EDIT = cyan
    fill; active RUN = green fill; both black text. Saira Semi Condensed 700, `.12em`.

- **StatusStrip** (30px, `--k-bezel`) — left **RunLamp**: a 9px dot + label. Idle = dark dot,
  dim label. Running = green dot with glow, label `RUN · SIMULATING` in green. Right: four
  **MetricReadout**s (`Ticks / Bus Traffic / Rejections / Brain Size`), each = uppercase label
  (`--k-dim`) + value (`--k-phos` 13px 600) + `/ par N` (`--k-olive` 9.5px). A metric over par
  uses `.alert` → value in `--k-caution`. Rejections shows `1 / par 0` in caution by default.

- **BrainEditorPanel** — bezel panel, header `BRAIN EDITOR` (Saira Semi Condensed; "BRAIN" in
  `--k-phos`, "EDITOR" in `--k-olive`), meta `STATE MACHINE · 4 STATES`. Body = a 24px dotted
  grid canvas holding:
  - **StateNode** ×4 (`IDLE`, `REQUESTING`, `COMMANDING`, `HOLDING`): 150px wide, square border
    `--k-line2`, header strip (state name, Saira Semi Condensed 700 11px uppercase) + a status
    dot, body = dim 9px description. **Initial** state's dot = cyan with glow. **Selected** =
    amber border + ring. **Active during RUN** = green border + glow + tinted header (live
    highlight driven by the interpreter's current state).
  - **TransitionEdge** ×4 — SVG lines with arrowheads (`--k-line2`); the revoke/fault edge is
    a red dashed curve (`--k-warn`).
  - **EdgeChip** — a small label floating on each edge showing the trigger via `<Identifier>`
    (e.g. `MA_ControlRequestStatusMT [==APPROVED]`), the guard in `--k-amber`. Fault edges get
    a `.warn` chip (red guard).

- **TransitionForm** — bezel panel under the editor, header `TRANSITION`, meta shows selected
  edge `REQUESTING → COMMANDING`. Rows (each: 9.5px uppercase label + control(s)):
  - **Trigger**: a field box showing the message type via `<Identifier>` (amber), dropdown caret.
  - **Guard**: field dropdown `CommandProcessingState` + operator chip `==` + value `APPROVED`.
  - **Action**: `SEND · MA_FlightCommandMT` (cyan) + `EDIT FIELDS ▸` button → opens SendActionForm.
  - Field preview row: required fields flagged with a caution `✱`, values in amber
    (`Altitude.Commanded 11500 ft`, `Direction.Heading 095°`).

- **TacticalMapPanel** — bezel panel, header `TACTICAL MAP`, meta `TOP-DOWN · GEO + OBJ`.
  Body hosts the **PixiJS** canvas (replace the placeholder SVG). Must render: terrain backdrop,
  dashed **geofence** polygon (`--k-olive`), dashed **objective zone** circle (`--k-green`),
  **aircraft** icon + dotted **trail** (`--k-cyan`), and an **AltitudeTape** gauge pinned to the
  right edge (44px wide): labeled ticks (15k/12k/9k/6k), a `CMD` marker (amber) and aircraft
  marker (green). Caption bottom-left: `PixiJS · Tactical Map`.

- **MissionCard** — bezel panel, header `MISSION CARD`. Body: `OBJECTIVE — ` (dim) then objective
  text; a green `WIN ▸ …` line for the win condition.

- **BodySpecSheet** — bezel panel, header `BODY SPEC SHEET`, meta `MA_FlightCapabilityMT`. Body =
  a key/value data list (dim key left, value right). `MaxAltitude 12000 ft` is shown in
  `--k-caution` because it's the binding constraint this level; `ControlAuthority HSA` value in
  cyan (a `.ref`). Bind to the body's advertised capability profile.

- **MessageLogPanel** (THE PILLAR — must stay full-height and never collapsible) — header
  `MESSAGE LOG`, meta `BUS · MA ⇄ FA`. Body:
  - **LogHead** sticky row: `TICK | DIR | TYPE · DISPOSITION` (3-col grid: 42px 50px 1fr).
  - **LogRow** per bus message: tick (`--k-dim`), direction (`MA→FA` in cyan / `FA→MA` in amber),
    then a two-line type cell: line 1 = message type via `<Identifier>`; line 2 = a
    **DispositionBadge**. Hover tints the row; selected row = amber tint + left amber bar.
  - **DispositionBadge** — semantic (see color map). `delivered` = outlined dim; `IGNORED — not
    secondary controller` = olive on faint olive; `REJECTED · PERFORMANCE_LIMIT_EXCEEDED` =
    caution-yellow fill black text; `APPROVED/ACCEPTED` = green fill; `REVOKED` = red fill.

- **InspectorPanel** — drops in at the **bottom of the log pillar** when a row is selected
  (it does not replace the log; the log scrolls above it). Header = the message type via
  `<Identifier>` + close `✕`. A **disposition banner** (badge + colored reason). Then a
  **FieldTree**: indented payload with guide lines; each leaf = `key: value`; required fields get
  a `REQ` chip; enum/failed values colored (`--k-caution` for the failed result, amber for
  requested/limit values); notes in olive (e.g. `= cap.MaxAltitude`). Default open on the rejected
  row.

**Interactions** (primary console):
- Click a **LogRow** → select it (amber bar) and open/refresh the **InspectorPanel** with that
  message's payload tree. Close `✕` hides the inspector.
- Toggle **EDIT / RUN**: RUN energizes the RunLamp (green glow), lights the active StateNode,
  sets the play button to playing; EDIT halts (`EDIT · HALTED`).
- Click a **StateNode** → select (amber ring). (Full editing — add/rename/delete states, wire
  transitions — is the editor's job; see prompt 06.)
- **TickTransport**: play/pause/step/speed scrub the deterministic sim; the log auto-scrolls and
  the active state follows the interpreter while running.

### 2. Compliance Test Report  (`02-compliance-report.html`)

Score screen styled as a formal test record. **TitleBlock** (form id, title `COMPLIANCE TEST
REPORT`, mission/body/standard/run fields, and a rotated green **PASS stamp** when all
interactions pass). **InteractionResults** table: VI ID · interaction name · PASS/FAIL badge,
one row per tested VI interaction. **MetricHistograms**: the four metrics, each a small bar
distribution (population) with the **player's bar highlighted** (amber, or caution for an
over-par metric like Rejections) plus a percentile note and par. Footer: CI certification line +
`LEVEL SELECT / RETRY · OPTIMIZE / NEXT MISSION` buttons. Bind histograms to the global
distribution service; bind PASS/FAIL to the per-interaction validator results.

### 3. Level Select  (`03-level-select.html`)

Five **World** columns (W0 *Listen Before You Speak* → W4 *Brain Swap*), each with a header
(stencil world no, name, `N/N CLEARED` progress) and a list of **LevelCard**s. Each card: level
id (mono, cyan) + name, a row of three **metric medals** (`T`/`B`/`S` for Ticks/Bus/Size, each
gold / silver / unearned), and a status (`cleared` / `▶ resume` / `locked`). Current level =
amber ring + glow. The capstone card gets a red `◆ Capstone · zero edits` tag. Bind medals to
saved best metrics, lock state to progression.

### 4. Send-Action Form  (`04-send-form.html`)

A modal dialog (over a dimmed console) for composing a send action. **MessageTypePicker** (cyan,
shows `MA_FlightCommandMT` + payload kind). **FieldList**: one row per payload field with name
(via `<Identifier>`), a `REQ` flag, the field type, and a **value-source segmented control
`LIT | CAP | MSG`** + value box. The three sources are the heart: **LIT** = literal (amber
value), **CAP** = reference to a body capability (`cap.*`, cyan), **MSG** = a field captured from
the triggering message (`msg.*`, amber). Right side: two **palettes** — **Body Capabilities**
(`cap.*`, cyan dot) and **Captured Fields** (`msg.*`, amber dot) — draggable onto value boxes.
Footer: validation summary (`all required fields satisfied · values within advertised envelope`)
+ `CANCEL / INSERT ACTION ▸`. Bind the type list to the message catalog, `cap.*` to the body
profile, `msg.*` to the triggering message's fields, and validation to the catalog's required-field
+ envelope rules.

---

## Interactions & Behavior (cross-cutting)

- **Selection model**: one selected log row at a time → drives the inspector. One selected
  state/transition at a time → drives the transition form.
- **Live RUN highlight**: the interpreter's current state id sets `.active` on the matching
  StateNode; transitions taken can pulse briefly (optional polish).
- **Transitions/animation**: keep motion minimal and instrument-like. State glow and lamp use
  CSS box-shadow; no decorative looping animations. The only flourish in the reference is a brief
  blink on a freshly-rejected row — optional.
- **No truncation of identifiers, ever** — message and field names are real and must render in
  full (the `<Identifier>` component wraps/ellipsizes the *row* if needed but the inspector and
  forms always show the full name). Make columns and panels accommodate the longest names
  (`MA_PositionReportDetailedMT`, `CAPABILITY_NOT_SUPPORTED`).
- **Density discipline**: this is the easiest direction to over-pack. Hold the 8px panel gap /
  9px panel padding / 22px header rhythm; don't shrink type below the scale below.

## State Management

Minimum state the console reads (names illustrative — map to your store):

- `sim`: `{ tick, running, speed, status }` — drives TickTransport, RunLamp, EditRunSwitch.
- `log: LogEntry[]` — the bus, appended per tick by the FA engine / interpreter. Drives the log.
- `selectedLogIndex` — drives InspectorPanel.
- `brain: { states, transitions, initialStateId }` + `activeStateId` (from interpreter) — drives
  the editor + live highlight.
- `selectedTransitionId` / `selectedStateId` — drives TransitionForm / node selection.
- `body: CapabilityProfile` — drives BodySpecSheet + `cap.*` palette.
- `mission: { objective, winCondition }` — drives MissionCard.
- `metrics: { ticks, busTraffic, rejections, brainSize }` + `pars` — drives StatusStrip + report.
- `world: { aircraft, trail, geofence, objectiveZone, altitude }` — drives the PixiJS map.

See **Data Contracts** below for the exact shapes; these should mirror your codegen'd catalog
types, not be re-invented.

---

## Data Contracts

> These are the prop/IO shapes the UI binds to. Align field names with your generated catalog
> types where they overlap; the UI must not invent message semantics.

```ts
// One message on the bus, as the log + inspector consume it.
type Direction = 'MA→FA' | 'FA→MA';

type DispositionKind =
  | 'delivered'      // neutral / dim
  | 'pending'        // neutral
  | 'accepted'       // green   (ACCEPTED / APPROVED)
  | 'ignored'        // olive   (not secondary controller — silent ignore)
  | 'rejected'       // caution-yellow (validator failure)
  | 'revoked';       // warning-red    (control revoked / fault)

interface Disposition {
  kind: DispositionKind;
  reason?: string;   // e.g. 'PERFORMANCE_LIMIT_EXCEEDED' — render via <Identifier> as enum
}

interface LogEntry {
  tick: number;            // render zero-padded: 0017
  direction: Direction;
  messageType: string;     // e.g. 'MA_FlightCommandStatusMT'
  disposition: Disposition;
  payload: FieldNode;      // root of the inspector tree
}

// Inspector field tree (recursive).
interface FieldNode {
  key: string;
  value?: string;          // formatted display value
  required?: boolean;      // → REQ chip
  kind?: 'enum' | 'bad' | 'ref' | 'value';  // bad = caution; enum/ref = amber/cyan
  note?: string;           // dim olive annotation, e.g. '= cap.MaxAltitude'
  children?: FieldNode[];
}

// Brain graph.
interface GuardExpr { field: string; op: '=='|'!='|'<'|'<='|'>'|'>='; value: string; }
interface Trigger   { messageType: string; guard?: GuardExpr; }     // or { tickTimer: number }
type Action =
  | { kind: 'send'; messageType: string; fields: SendField[] }
  | { kind: 'set'; variable: string; value: string }
  | { kind: 'goto'; stateId: string };
interface Transition { id: string; from: string; to: string; trigger: Trigger; actions: Action[]; fault?: boolean; }
interface BrainState { id: string; name: string; description?: string; initial?: boolean; }
interface Brain { states: BrainState[]; transitions: Transition[]; }

// Send-action field, with the three value sources.
type ValueSource = 'LIT' | 'CAP' | 'MSG';
interface SendField {
  path: string;            // e.g. 'HSA_CSA.Altitude.Commanded'
  required: boolean;
  type: string;            // 'float · ft', 'enum', 'EntityID'
  source: ValueSource;
  value: string;           // literal, 'cap.MaxSpeed', or 'msg.NavigationReportMT.BearingToZone'
  display?: string;        // resolved preview, e.g. '110 kt'
}

interface CapabilityProfile {  // body spec sheet + cap.* palette
  maxAltitude: number; maxSpeed: number; maxClimbRate: number;
  maxTurnRate: number; controlAuthority: string; /* … */
  capabilityId: string;
}

interface Metrics { ticks: number; busTraffic: number; rejections: number; brainSize: string; }
```

---

## Design Tokens

Authoritative values live in `design_reference/milspec.css` (CSS custom properties) and are
mirrored in `tokens.css` / `tokens.ts` in this folder. Summary:

**Colors**
| Token | Hex | Meaning |
|---|---|---|
| `--k-black` | `#0a0d0a` | app background (green-tinted near-black) |
| `--k-panel` | `#11150f` | panel fill |
| `--k-panel2` | `#161b13` | raised panel fill |
| `--k-bezel` | `#070a07` | strips / bezel |
| `--k-line` | `#2c3325` | hairline border |
| `--k-line2` | `#3c4632` | stronger border |
| `--k-olive` | `#5d6b3f` | secondary label / ignored |
| `--k-olive-dim` | `#3f4a2c` | dim olive |
| `--k-phos` | `#c2cdb0` | primary text (phosphor) |
| `--k-dim` | `#7d876b` | dim labels |
| **`--k-cyan`** | `#3fc6d6` | **MA sender / references (`cap.*`)** |
| **`--k-amber`** | `#e0a322` | **FA sender / advertised + literal values** |
| `--k-green` / `--k-ok` | `#8fd06a` / `#6fce8a` | nominal / accepted / pass |
| **`--k-caution`** | `#f2c200` | **REJECTED (validator failure) — semantic only** |
| **`--k-warn`** | `#e0483a` | **REVOKED / fault — semantic only** |

**Semantic color map (do not deviate):**
`MA = cyan`, `FA = amber`, `delivered/pending = dim`, `accepted/approved = green`,
`ignored (not controller) = olive`, `rejected = caution-yellow`, `revoked/fault = warning-red`.
Caution-yellow and warning-red are reserved exclusively for those two dispositions.

**Typography**
- **Data / identifiers / values**: `IBM Plex Mono` (400/500/600). The workhorse.
- **Chrome labels / panel headers / state names**: `Saira Semi Condensed` (600/700), uppercase,
  `.10–.14em` tracking.
- **Brand / title accents only**: `Saira Stencil One` (the `BRAIN SWAP · GS-1` mark, report title).
- **Kalam** appears in the references for *wireframe annotations only* — **do not ship it.**
- Scale: panel header 12px · body data 10px · log rows 10px · metric value 13px · chrome title
  13px · mission/report body 10–11px. Treat these as minimums at the reference size; scale up
  with the viewport, never down past ~10px for identifier text.

**Spacing & shape**
- Panel grid gap **8px**; panel inner padding **9px**; panel header height **22px**; status
  strip **30px**; chrome bar **58px**; selector strip **26px**.
- **Border radius: 0** everywhere (square MIL-spec bezels). Decorative **rivets** = 5px radial
  dots in panel corners (purely cosmetic; optional in-engine).
- Borders are 1px hairlines (`--k-line` / `--k-line2`) plus an inset `1px` dark line for the
  bezel feel (`box-shadow: inset 0 0 0 1px #0c0f0a`).

**Identifier primitive (the key tweak — implement first):**
```tsx
// Splits a long A-GRA identifier so the semantic core reads first.
// 'MA_FlightCommandStatusMT' → dim 'MA_' + bright 'FlightCommandStatus' + dim 'MT'
// enums ('PERFORMANCE_LIMIT_EXCEEDED') render in amber/caution depending on context.
function Identifier({ name, enumStyle }: { name: string; enumStyle?: 'enum'|'bad' }) {
  if (enumStyle) return <span className={`id-enum id-${enumStyle}`}>{name}</span>;
  const pfx = name.startsWith('MA_') ? 'MA_' : '';
  const sfx = name.endsWith('MT') ? 'MT' : '';
  const core = name.slice(pfx.length, name.length - sfx.length);
  return (
    <span className="id">
      {pfx && <span className="id-pfx">{pfx}</span>}
      <span className="id-core">{core}</span>
      {sfx && <span className="id-sfx">{sfx}</span>}
    </span>
  );
}
// .id-pfx,.id-sfx { color: var(--k-dim) }  .id-core { color: var(--k-phos) }
// .id-enum.id-bad { color: var(--k-caution) }  .id-enum.id-enum { color: var(--k-amber) }
```
Use it in the log type cell, inspector tree, edge chips, transition form, and send form.

---

## Assets

No raster assets. All visuals are CSS/SVG primitives plus the tactical map, which is a
**PixiJS** scene (the reference uses a striped SVG placeholder). Icons are unicode glyphs
(`▶ ❚❚ ⏭ ✱ ✕`); swap for your icon set if you have one. Fonts are Google Fonts (IBM Plex Mono,
Saira Semi Condensed, Saira Stencil One) — self-host to match your build.

---

## Files

In `design_reference/`:
- `milspec.css` — the authoritative theme tokens + shared component CSS (bezels, badges, log,
  inspector, identifier dimming). Start here.
- `01-milspec-console.html` — primary console (interactive: log-row select → inspector,
  EDIT/RUN switch, node select).
- `02-compliance-report.html` — Compliance Test Report secondary screen.
- `03-level-select.html` — Level Select secondary screen.
- `04-send-form.html` — Send-Action Form modal.

Also in this folder:
- `PROMPTS.md` — a sequenced set of copy-paste prompts for Claude Code to build each piece
  against your codebase, with acceptance criteria.
- `tokens.css` / `tokens.ts` — the design tokens as CSS variables and a typed TS export.

> Tip: open the HTML files in a browser while implementing — the console is interactive, so you
> can click log rows and flip EDIT/RUN to see the exact intended states.
