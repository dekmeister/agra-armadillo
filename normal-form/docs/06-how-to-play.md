# How to Play (in-game help — spec + copy)

The sibling convention (Brain Swap's `WelcomeOverlay` + `Help` meta screens):
a **first-visit welcome card** and a **HOW TO PLAY screen** reachable from the
header at all times, styled as another Blueprint document. This doc is the
source of truth for both — the in-game components render this copy (edit here
first, then port).

Two surfaces, one voice:

1. **Welcome card** — first visit, dismissible, ~15 seconds of reading. Its job
   is orientation: what UCI is, who you are, what button to press first.
2. **HOW TO PLAY screen** — the in-game README. Its job is the loop and the
   screen map. It must be skimmable mid-puzzle (a stuck player opens it looking
   for one answer).

Everything below is player-facing copy. UCI's name and description follow the
standard's own words (STD-001 §1: "Universal Command and Control (C2) Interface
(UCI) is a messaging standard").

---

## Welcome card copy

> **NORMAL FORM · SEQUENCE CERTIFICATION**
>
> **UCI — the Universal Command and Control (C2) Interface — is a messaging
> standard**: a common grammar that lets independently built systems command,
> query, and inform each other without sharing code, hardware, or even a
> transport. This game teaches you that grammar.
>
> **You are a certification engineer.** Each *sheet* is a job: compose a
> message interaction between two components, wire the small machine that
> handles the responses, then prove it survives a bus that is allowed to
> reorder, duplicate, and drop — because the real standard guarantees none of
> those things.
>
> Everything on the board is real: the message names, the fields, the state
> enums, and every rule that fails you is quoted verbatim from the standard.
>
> **[ START — SHEET 0-1 ]** · **[ HOW TO PLAY ]** · **[ UCI REFERENCE ]**

(No cookies/localStorage gating needed once persistence lands — show the card
when no save exists.)

---

## HOW TO PLAY screen copy

### The idea

You certify interactions between **UCI Components**. A sheet gives you a
**goal** (always a real-world outcome — "SystemB performs the tasked activity;
you hold proof" — never "message sent"), a **palette** of interaction patterns,
and a hostile **bus**. Pass every seed and the sheet is stamped **CERTIFIED**.

### The screen

- **PALETTE** (left) — the six UCI interaction patterns. The unlocked chip is
  this sheet's tool; click it to place its arrows. Locked chips still teach:
  click any of them to read what that pattern is for.
- **DIAGRAM** (center) — the board *is* a sequence diagram, the standard's own
  notation: lifelines are components, arrows are messages, time runs downward
  in ticks.
- **INSPECTOR** (right) — the workbench, in three sections top to bottom:
  **COMPOSE** (fill the message's envelope and ID fields), **HANDLERS** (one
  rule per response state: `wait`, `terminal ✔`, or `retry`), **RUN** (the
  seed list and results).
- **VALIDATOR** (bottom) — the game's voice. Compose errors, readiness, the
  run's tick-by-tick event log, and — when a seed kills you — the violated rule
  quoted verbatim from the standard.
- **TITLE BLOCK** (bottom-right) — sheet metadata and the ⚑ FIDELITY NOTES
  panel: exactly where the game simplifies the real standard.

### The loop

1. **Compose.** Place the pattern, then fix the envelope: sheets arrive with
   broken fields, and the validator blocks RUN until it's clean — just like the
   real certification tooling.
2. **Wire handlers.** Decide what your machine does on each response state.
   Beware anything you *inherited* — pre-wired templates carry assumptions.
3. **Run every seed.** Seed ① is the polite, in-order bus. The rest are legal
   cruelty: the standard says *"there can be no assumption that messages come
   in any order or that there is guaranteed delivery"* — so the seeds reorder,
   duplicate, and (for fire-and-forget patterns) drop. **RUN ALL** checks every
   seed at once; click a failed seed to watch it, and **⤳ scrub to fault** to
   jump to the tick where your assumption broke.
4. **Read the failure.** Every failure quotes the rule you violated, chapter
   and verse. The fix is always in the quote.
5. **CERTIFIED** — all seeds pass, the recap line names what you proved, and
   the next sheet unlocks.

### Reading the stamps

- `✖ REJECTED · n ERR` — the validator blocked you at compose time.
- `HANDLERS NOT READY` — composition is clean but the machine can't reach a
  terminal state yet.
- `✖ NO PROOF` — the run ended and your machine was still waiting (a hang: it
  assumed an ordering or a delivery the bus never owed it).
- `✖ FAULT` — your machine acted when it should have ignored (e.g. re-fired on
  a duplicate after reaching a terminal state).
- `✔ CERTIFIED` — goal reached on **all** seeds.

### The one big rule

The bus owes you nothing. Any machine that assumes ordering, delivery, or
exactly-once will die on some seed — and the seed will show you exactly which
assumption it was. Robustness *is* the puzzle; the standard's normalized
behaviors are the answer key.
