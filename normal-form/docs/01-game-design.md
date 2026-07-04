# Normal Form — Game Design Document (one page)

**Genre.** Zachtronics-style protocol puzzle (SpaceChem / TIS-100 mould), browser,
single-player.
**Scope.** A **short teaching game**: one 30–40 minute playthrough (~8 sheets +
epilogue) after which a newcomer understands UCI messages — the envelope, the six
primitive patterns, the -2 state handshakes, and the hostile-bus rules. Depth,
optimization meta, and schema authorship are explicitly *not* goals (see
"Post-1.0" in `03-levels.md`).
**Premise.** You are an integration engineer certifying interactions between
abstract **UCI Components**. No aircraft, no domain fiction — UCI's deliberate
abstraction (technology-agnostic, multi-domain, "does not prescribe hardware,
message encoding, or networking protocols") *is* the aesthetic, the way TIS-100's
abstract machine is. Each level is a **sheet**: a certification job with a goal, a
palette of message primitive patterns, and a hostile bus. Everything on the board
traces to the public UCI 2.5 standard — the six UNIS message primitive patterns,
the envelope, the state enums, the schema style rules. **If it can't be cited,
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
(5) Pass = goal state reached on **all** seeds — the sheet is stamped CERTIFIED
and the next sheet unlocks.

**The teaching mechanic is the bus.** A machine that assumes ordering, delivery,
or exactly-once dies on some seed, and the failure replay shows exactly which
assumption was false — with the CERT text quoted. Robustness across seeds is the
game; the spec's normalized behaviors are the answer key.

**No scoring. Certification is pass/fail.** All-seeds-pass is the only judgment;
there are no metrics, pars, or histograms (cut at the MVP review — in a 30-minute
teaching game the solutions are essentially fixed, so metrics were noise implying
an optimization depth the game doesn't have). The title block stays pure fiction
(sheet/world/scale cells). Every sheet ships a test-only **reference machine**
whose golden test proves the sheet solvable on all seeds — that remains the ship
gate.

**Win conditions are world-state based** — the requestee's activity executed, the
record present in the store, the subscription delivered N updates — never
"message sent". (Same principle as Brain Swap: a competent component consumes
state; an incompetent one can't even tell it succeeded. A Status-1 send is
*terminal on send* per UNIS §4.1.2 — so a -1 pattern's win is judged at the
consumer, which is what makes drop seeds teach.)

**Progression (two worlds + epilogue, one lesson per level, ~35 min).**
W0 **One Way** (3 sheets) — Status-1 / Data-1: envelope and validator literacy;
there is *no ack*, pattern choice is semantics. W1 **Ask & Acknowledge**
(4 sheets + 1 bonus) — the three -2 patterns: state handlers, out-of-order,
duplicates, stragglers, REJECTED-path retries; request (may return data) vs
command (returns activity). Then the **epilogue debrief** (the A-GRA bridge).
Every sheet ends with a one-line **recap** ("You proved: terminal states ignore
stragglers — UNIS §4.6.2") so the lesson is named, not just survived.
Former W2 **Records**, W3 **The Forge**, and W4 **Program Schema** are cut from
1.0 — they teach schema *authorship* and program governance, a different audience
from "understand UCI messages in 30 minutes" — and live in `03-levels.md`
"Post-1.0" with their designs intact.

**The lesson must be guaranteed, not opt-in.** Fail-then-fix is the teaching
mechanic, so every sheet *arrives broken*: pre-filled wrong envelope fields in
COMPOSE, and where the lesson is a machine assumption, an inherited
plausible-but-wrong machine (e.g. 1-1 ships with its "sequential handler
template" gate pre-checked so seed ② is a guaranteed kill). Certification finds
the breaks in what you were handed.

**Meta surfaces (sibling convention — Brain Swap's Help / MessageCodex /
WelcomeOverlay).** A first-visit **welcome card** (what UCI is, in three
sentences), a **How to Play** screen (`06-how-to-play.md`), and a **UCI
Reference** codex bound to the generated, fidelity-policed catalog
(`07-uci-reference.md`) — reachable from the header at all times.

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
