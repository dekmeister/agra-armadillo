# PLAN_VISUALS.md — bespoke per-level board visuals (future sessions)

The campaign is wired to a **generic scenario-driven board**: nodes/links/tokens/lifecycle/beats/actions
all derive from the active `GameState`, so every level is playable and legible. This doc captures the
**bespoke per-level flourishes** deferred out of the wiring pass — each would make a level's specific
lesson land harder. High-level only; a future session picks one up and designs the details.

Guard rail unchanged (CLAUDE.md): visuals may abstract *content* but must never misrepresent *topology*.
Flag any presentational simplification `[S]` in `docs/01`.

Shared groundwork most of these assume (do once, first): a small per-scenario **overlay slot** in
`Graph.svelte` — a `{#if scenarioId === "phaseN"}` region rendered above the generic board — plus any
per-level view-model helpers in `sim-adapter.ts` (pure `GameState -> VM`, no new sim state).

---

## L1 Launch / L2 Hold — the on-platform VI free lane
- **Idea:** render the self-loop VI link (`vi`, `from===to`) as a distinct **on-platform lane** hugging
  the ACP rim — a closed, always-green arc labelled "on-platform · free", visually *inside* the platform
  and clearly NOT crossing the shaded OTA mesh. Contrast with the C2 link that does cross.
- **Why:** the whole L1/L2 lesson is "VI is free and never crosses the air." A self-loop rendered as a
  normal straight rail reads as a bug; a rim arc reads as the point.
- **Data:** already in state (`links.vi`, `MA_VehicleCommandMT` tokens). Needs a loop-arc path in
  `layout.ts` for `from===to` links (the generic board should at least stub this).

## L2 Hold — the FAIL_MISSING_ACK "sent, unconfirmed" motif
- **Idea:** a distinct token treatment for terminal `FAIL_MISSING_ACK` reports — a hollow/ghost token
  with a "?" that lingers at the destination rim, versus the transient `FAIL_UNSENT` (which never shows).
  A small "unconfirmed" tally near the LRE.
- **Why:** L2 teaches the two failure modes; making MISSING_ACK visually terminal-but-maybe-arrived sells
  "delivery ≠ confirmation." (Phase 6 already has a bespoke hero glyph for this — generalize its language.)

## L3 Team Formation — live election / vote / quorum visualization
- **Idea:** during an election, animate request-vote / vote-reply messages along the P2P mesh; show a
  **vote tally ring** on the candidate (filled arcs = votes gathered, dashed = quorum threshold). On the
  Raft stall (partition), the ring freezes below quorum with a "NO QUORUM" flag; Static shows an instant
  local declaration badge. Surface `election.msgCount` as a running cost meter.
- **Why:** the cost-vs-quorum trade is the lesson; a static "leader elected" log line hides it. The tally
  ring makes "Raft needs a majority and stalls without one" visible.
- **Data:** `state.election` (method/term/votes/quorum/leader/msgCount) — all present.

## L4 Transit — bandwidth meter + heartbeat freshness gauge
- **Idea:** on the capped `form` link, a **bandwidth gauge** (demand vs cap this tick) and a **heartbeat
  freshness bar** (the `cop` scalar repurposed) that visibly drains under FIFO and refills under Class/EDF.
  Animate the routine-C2 backlog piling up behind the heartbeat under FIFO.
- **Why:** makes "queue discipline decides who gets the air" a cause-and-effect the player watches, not
  infers from a loss screen.

## L5 CAP — per-follower COP freshness meters
- **Idea:** a small **freshness meter per follower node** (green→amber→red), each draining on its own
  budget and refilling when a COP sync lands. The breaching follower flashes. A "fan-out cost" counter on
  the leader scales with follower count. `shedTraffic` visibly clears the bulk MD/MP tokens.
- **Why:** L5's headline is "COP is one-to-many; freshness is per-recipient." Three independent meters
  show that far better than one scalar. `copColor()` in `sim-adapter.ts` already maps value→color.
- **Data:** `state.copFollowers` (per-node value) — present.

## L7 RTB @ Bingo — split-brain rendering + authority hand-back
- **Idea:** when the package partitions, **visually split the board** — a severed seam across the crossing
  links, the orphan half tinted, two ★LEADER crowns shown simultaneously (the split-brain hazard made
  literal). `mergeTeam` animates the halves rejoining to one crown. For the RTB gate, a REJECTED stamp at
  the QB and an authority token visibly moving QB→LRE on `handBack`.
- **Why:** "two leaders is a hazard; merge only on command" is abstract until you see two crowns and have
  to collapse them. The authority hand-back is the inverse of L6's gate — showing the token move ties them.
- **Data:** `state.partition` (halves), per-node `isLeader`, interaction `approval`/`authorityVerified`.

## L8 Land — campaign recap ribbon
- **Idea:** a debrief **ribbon** tracing the eight phases (the six-interface tour), each lit as visited,
  culminating in the clean LRE landing. Reuse `campaign-debrief` beat copy.
- **Why:** L8 is the capstone/recap; a whole-campaign visual closes the arc L1 opened.

---

## Cross-cutting polish (any level)
- **Legend per interface class:** the token shape/color map now spans all six classes (C2/P2P/VI/MS/MD/MP)
  — give `Legend.svelte` the full set instead of the C2/P2P pair.
- **Contested-link language:** the generic board shows `channel === "BAD"` as CONTESTED; consider a
  per-link "severed" state (blockBad=1) distinct from "bursty" for L3/L7 partitions.
- **Objective copy per level:** the generic Objective panel shows scenario title + status; bespoke
  per-level objective/auth lines (like Phase 6's "needs QB authority") would read better.
