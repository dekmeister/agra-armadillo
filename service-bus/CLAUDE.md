# CLAUDE.md — Service Bus

A browser routing/throughput game teaching **A-GRA's topology and message-flow layer**: which
interactions flow over which of the six L1 interfaces, between which nodes, gated by what, under what
link conditions. Third of three A-GRA learning games (the others teach the VI interface deeply and the
compliance regime). Grounded in A-GRA **ASK 5.0a**, which builds on **UCI 2.5**.

> Note: a root `/mnt/server/CLAUDE.md` governs home-server *operations*. It does not apply to work
> inside this project directory — this file does.

## The non-negotiable guard rail
Abstract message **content** freely; **never misrepresent message topology** — who talks to whom, over
which interface, gated by what. Real names, real message structures, real sequence semantics. Simplify
only where fidelity would kill playability, and **flag every simplification `[S]`** so the game never
teaches something false. When unsure whether a mechanic is faithful, check `docs/` before coding it.

## Source standards (`docs/`)
PDFs plus `.txt` extractions of each. **Always read the `.txt`, and grep large ones — do not load them
whole** (C2 vol ~25k lines, Peer ~23k, MS ~10k).
- `ASK 5.0a Start Here Guide.doc.txt` — small, read whole. OV-1 DCA vignette, the six L1 interfaces, RBAC roles, acronyms.
- `ASK 5.0a Command and Control Interface Volume.txt` — C2 paradigms, RBAC, approval/weapon flow.
- `ASK 5.0a Mission Systems Interface Volume.txt` — DMS lifecycle, PNT, sensors, link-health messages.
- `ASK 5.0a Peer Interface Volume.txt` — team formation, leader election, COP, peer contingencies.

There is no standalone VI/MP/MD volume in `docs/` — fine; this game's OTA-heavy interfaces (C2, P2P,
MS-DMS) are all present. VI is the *other* game's deep target.

## Design set (`design/`) — read before changing direction
`00` one-pager · `01` mechanics→A-GRA mapping (all `[S]` flags) · `02` mission phases (OV-1) ·
`03` failure/degradation · `04` tech + MVP. `README.md` indexes them.

## Locked design decisions
- **Fabric = the real DMS** (Decentralized Messaging Service) / Abstract Service Bus (ASB). The board
  renders the DMS, not an invented abstraction.
- **Cargo = interactions** (a request + its required status reply — a round trip), the unit A-GRA
  compliance is assessed at. Not one-way packets.
- **Failure vocabulary = real DMS lifecycle:** `PENDING → EXECUTING → SENT / FAIL_UNSENT / FAIL_MISSING_ACK`
  (from `MA_TxDataPayloadCommandStatusMT`). `FAIL_MISSING_ACK` on a return leg is the core drama.
- **Not all six interfaces cross the contested air.** VI (MA↔Flight Autonomy) and local sensor reads are
  **on-platform and reliable**; only C2, P2P, MS-DMS/COP, and MP/MD *updates* are OTA and feel
  bandwidth/latency/loss. (Corrects a topology error in the initial concept — keep it correct.)
- **Authority is checked at the destination — arrival ≠ effect.** Five RBAC roles
  (Admin / QB / AVC / LRE / Observer) gate commands; unauthorised → `REJECTED` / `CannotComply`.
- **Weapon employment is a distinct gated flow** through a Target Authority (the QB):
  `MA_ApprovalRequestMT → QB → MA_ApprovalRequestStatusMT(APPROVED)`, or
  `MA_DesignationRequestMT → MA_DesignationMT`.
- **Leader election = five named methods** (Bully / Maximum Consensus / Raft / Static Fitness Score /
  Off-Nominal), each with distinct message cost, run over the same degraded links that caused the loss.
- **RF link model:** directional links; **Gilbert–Elliott two-state burst loss** (chosen over iid because
  tactical links fail in bursts); bandwidth, latency, intermittency all first-class and tunable.

## Tech stack (see `04` for rationale)
- **Sim core:** pure **TypeScript**, deterministic **tick engine**, **seeded PRNG**, **no framework, no
  DOM** — must run **headless** (Node) for parameter sweeps, and in-browser, from the same module. The
  whole game is `tick(state) -> state'` as a pure function of `(scenario, seed)`.
- **View:** **Svelte + SVG** for the graph; Canvas only if token density demands it (defer). HUD in Svelte.
- **No game engine** (Phaser/Pixi) — this is a graph + queues + a clock.
- Planned layout: `/sim` (pure, unit-tested) · `/view` (Svelte+SVG) · `/scenarios` (JSON) · `/headless`
  (Node sweep harness → CSV). Keep `requestAnimationFrame`/time strictly in the view layer.

## MVP scope
**One phase (OV-1 Phase 6, Threat Engagement at CAP), two interfaces (C2 + P2P), one contingency.**
3 ACPs (one leader) + QB + DMS relay; P2P COP fan-out kept under a freshness threshold; one-shot strike
approval round trip gated to the QB role with a WEZ deadline; scripted QB→leader return-link drop →
`FAIL_MISSING_ACK`. Ship **Raft + Static** election only. Out of MVP: other 4 interfaces, other phases,
team-split/re-election, dynamic ACP geometry, ROE/WEZ detail beyond one gate flag.
Build order: deterministic sim + DMS lifecycle + headless harness **first**, then RBAC gate, then COP
fan-out, then view, then param-sweep CSV.

## Working conventions
- Keep the sim deterministic and headless-testable; no rendering coupling. Seeded RNG only.
- Use real A-GRA message/interaction names in code identifiers and comments where practical.
- When adding a mechanic, cite the `docs/` basis; if it's a simplification, mark it `[S]` in code and in `design/01`.
- This is a learning project for a domain expert (aerospace SE; RF/EMC; DO-178C/DO-377A). Be precise and
  technical; surface fidelity trade-offs explicitly rather than smoothing them over.
