# Prompt for Claude design — Normal Form UI mockups

Mock up the UI for **"Normal Form"**, a Zachtronics-style (SpaceChem / TIS-100 lineage)
single-player browser puzzle game. I want **3–4 genuinely distinct visual/layout
directions** of the same screen set so I can compare approaches — not one design with
color variations. Desktop browser first (~1440×900); information-dense but readable.

## What the game is

The player is an integration engineer certifying message interactions between abstract
software components, using a real (unclassified, public) military messaging standard
called UCI. There is deliberately **no fiction, no aircraft, no map** — the standard's
own abstraction is the aesthetic. The spec document itself is the star: error messages
quote real certification requirements, and the game board is literally the spec's own
notation (sequence diagrams).

Core loop, in three phases on one screen:

1. **COMPOSE** — drag *interaction pattern primitives* from a palette onto a
   **sequence-diagram board**: vertical lifelines as columns (2–4 components, e.g.
   "Commander" / "Commandee"), with the primitive rendering as message arrows between
   them. Select a message arrow to fill in its **envelope fields** in an inspector
   panel (SystemID, Timestamp, SchemaVersion, Mode, a UUID). A static validator
   blocks running with spec-style errors, e.g.:
   `✖ CERT SCH-000164 — MessageHeader missing required SystemID`
   `✖ RQMT USTD-000436 — CommandID is not a valid RFC-4122 UUID`
2. **HANDLERS** — attach small reactive rules to the initiating lifeline: a tiny
   state-machine widget, e.g. `on CommandStatus: RECEIVED → wait · ACCEPTED →
   terminal ✔ · REJECTED → resend (max 1)`.
3. **RUN** — press play; messages animate down the diagram tick by tick. The message
   bus is *legally hostile*: it may reorder, duplicate, or drop messages, and send
   stragglers after the interaction is finished. The player's composition must pass
   **all N seeds** (e.g. `seed 3/8: ACCEPTED arrived before RECEIVED — handled ✔`).
   A seed tracker shows pass/fail per seed. Win = goal state reached on every seed.

**Scoring (Zachtronics 3-metric):** Messages sent · Machine size · Ticks, each vs. a
par value, shown on a post-level score screen.

## Palette contents (use these real names)

Six primitives: `Status-1`, `Data-1`, `DataRecord-1` (one-way, fire-and-forget) and
`DataRequest-2`, `ActionRequest-2`, `Command-2` (send-and-respond pairs). Some levels
lock/omit primitives.

## Screens to mock (per design direction)

1. **Main puzzle screen** (the hero — required in every direction). Must contain:
   primitive palette · sequence-diagram board (the visual centerpiece; must scale
   2→4 lifelines) · envelope inspector for the selected message · handler editor ·
   run controls (play/step/reset, tick counter) · seed tracker · validator/error
   console (prominent — reading errors is a core mechanic) · goal statement.
2. **Post-level score/debrief screen** — pass/fail per seed, three metrics vs. par,
   and the level's one lesson stated with its spec citation.
3. **Level select** — five worlds ("One Way", "Ask & Acknowledge", "Records",
   "The Forge", "Program Schema"), one lesson per level.
4. *(Stretch, pick your strongest direction only)* **The type bench** — a mid-game
   mode where the player constructs a message *type* as a schema tree
   (`TaskCommandMT: extends MessageType → CommandID: ID_Type → Target: ◇choice…`).

## Concrete content for the mockups (use this, not lorem ipsum)

Level **"1-1 First Acknowledgement"** — Goal: *"SystemB performs the tasked activity;
you hold proof."* Palette: `Command-2` only. Lifelines: `Commander (you)` and
`Commandee (SystemB)`. Messages: `TaskCommand` → and ← `TaskCommandStatus`.
Envelope fields: SystemID `sys-alpha-01`, Timestamp `2026-07-02T09:14:03Z`,
SchemaVersion `002.5`, Mode `LIVE`, CommandID `f81d4fae-7dec-11d0-a765-00a0c91e6bf6`.
Response states: `RECEIVED / ACCEPTED / REJECTED / CANCELED`.
Seeds: ① in-order ② ACCEPTED before RECEIVED ③ duplicate status after terminal.
Pars: `2 messages · 3 handlers · ≤6 ticks`.

## Design directions to explore (suggested starting points — diverge freely)

- **Blueprint / technical drawing** — drafting lines, dimension ticks, stamp-style
  pass/fail marks; the diagram as an engineering print.
- **IDE / protocol debugger** — dark theme, monospace, dockable panels, the error
  console as a compiler output; closest to TIS-100's soul.
- **Paper spec document** — the level *is* a page of the standard: serif headings,
  numbered figures ("Figure 4.6-1"), red-ink CERT stamps for errors, marginalia.
- **Signal/oscilloscope terminal** — phosphor-on-black, messages as traces along
  lifelines, seeds as channel readouts.

## Hard constraints

- The **sequence diagram stays the hero** in every direction; palette/inspector/
  console arrange around it, never crowd it out.
- Message animation direction is vertical-time, horizontal-travel (standard sequence
  diagram semantics) — don't reinvent the notation; the point is that the player
  internalizes the *real* notation.
- Error/console text must be comfortably readable (players study it), and state
  enums (`RECEIVED`, `ACCEPTED`…) should be visually distinct at a glance.
- No military imagery, no skeuomorphic cockpit — abstract, clean, precise.
- Show at least one *failure moment* in each direction: a validator error in compose,
  or a seed failing mid-run.
