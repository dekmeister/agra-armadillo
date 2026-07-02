# Normal Form — Game Design Document (one page)

**Genre.** Zachtronics-style protocol puzzle (SpaceChem / TIS-100 mould), browser,
single-player.
**Premise.** You are an integration engineer certifying interactions between
abstract **UCI Components**. No aircraft, no domain fiction — UCI's deliberate
abstraction (technology-agnostic, multi-domain, "does not prescribe hardware,
message encoding, or networking protocols") *is* the aesthetic, the way TIS-100's
abstract machine is. Each level is a **sheet**: a certification job with a goal, a
palette of message primitive patterns, and a hostile bus. Everything on the board
traces to the public UCI 2.5 standard — the six UNIS message primitive patterns,
the schema style rules, Message Sets and Program Schemas. **If it can't be cited,
it's out.**

**Core loop (one screen, three phases).**
(1) Read the goal and the palette. (2) **COMPOSE** — drag primitives onto a
sequence-diagram board (lifelines as columns; authentic: UNIS defines each
primitive *as* a sequence-diagram figure, so the board is the spec's own
notation), bind concrete message types, fill envelope and ID fields. A **static
validator** — the game's CERT check, modeled on the real SchemaChecker — blocks
Run with real CERT/RQMT-style errors (`✖ RQMT USTD-000436 — CommandID is not a
valid RFC-4122 UUID`). (3) **HANDLERS** — attach a small reactive machine to each
response message, one rule per state enum (`RECEIVED → wait`, `ACCEPTED →
terminal ✔`, `REJECTED → retry (budget 1)`…). This machine is the thing being
certified. (4) **RUN** — execute against **N deterministic bus seeds**, each a
legal disruption schedule drawn only from what the spec permits: UNIS §4 — *"UCI
does not require a specific transport, so there can be no assumption that
messages come in any order or that there is guaranteed delivery."* Seeds reorder
responses, drop fire-and-forget messages, duplicate, and deliver post-terminal
stragglers (*"once a terminal state is reported… ignore any further responses"*).
(5) Pass = goal state reached on **all** seeds. Then optimize and re-run.

**The teaching mechanic is the bus.** A machine that assumes ordering, delivery,
or exactly-once dies on some seed, and the failure replay shows exactly which
assumption was false — with the CERT text quoted. Robustness across seeds is the
game; the spec's normalized behaviors are the answer key.

**Scoring (Zachtronics 3-metric, per-level pars + histograms later).**
- **Messages** — total messages sent across all seeds' worst case.
- **Machine size** — primitives placed + handler rules wired.
- **Ticks** — worst-seed completion time.
All-seeds-pass is the **gate**, not a metric. Leaderboard-style optimization
lives in re-play, exactly like the siblings.

**Win conditions are world-state based** — the requestee's activity executed, the
record present in the store, the subscription delivered N updates — never
"message sent". (Same principle as Brain Swap: a competent component consumes
state; an incompetent one can't even tell it succeeded. A Status-1 send is
*terminal on send* per UNIS §4.1.2 — so a -1 pattern's win is judged at the
consumer, which is what makes drop seeds teach.)

**Progression (five worlds, one lesson per level).** W0 **One Way** — Status-1 /
Data-1: envelope and validator literacy; there is *no ack*, pattern choice is
semantics. W1 **Ask & Acknowledge** — the three -2 patterns: state handlers,
out-of-order, duplicates, stragglers, REJECTED-path retries; request (may return
data) vs command (returns activity). W2 **Records** — DataRecord-1 and the two -3
composed patterns; first multi-primitive machines. W3 **The Forge** — construct
`<MsgName>MT` types on a type bench under SPC-001's CERT rules, then the
versioning puzzles (STD-001 §5.2's change tables are ready-made rules); forged
types feed later palettes. W4 **Program Schema** — assemble a Message Set under
palette-cost pressure, multi-pattern missions, an Extension Message Set capstone.

**Tone & presentation.** Clean spec-document aesthetic — the shipped "Blueprint"
visual direction (drafting ink on vellum, red drafting stamps for errors, a title
block; see `../design_handoff_normal_form_blueprint/`). Failure screens quote the
actual CERT text. Each level has a **Fidelity Notes** panel (sibling convention)
stating exactly what is simplified relative to UCI 2.5, so the game never teaches
something false.

**Bridge to A-GRA.** Primitives keep their exact UNIS names throughout. The
epilogue/debrief shows the A-GRA mapping: *"`MA_FlightCommand` /
`MA_FlightCommandStatus` — you already know this shape: Command-2."* Normal Form
is the grammar course for the suite: Brain Swap plays one interface's sentences,
Service Bus routes the paragraphs, Normal Form teaches the parts of speech. The
full mapping table is in `02-fidelity.md`.
