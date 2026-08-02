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

## Source standards — in the **sibling repo**, not this one
The ASK 5.0a `.txt` extractions live at `../brain-swap/docs/A-GRA References/` (alongside
`A-GRA_MessageDefinitions_v5_0_a.xsd`). **Always read the `.txt`, and grep the large ones — do not
load them whole.** Present on this device:
- `ASK 5.0a Start Here Guide.doc.txt` — 277 lines, read whole. OV-1 DCA vignette, the six L1 interfaces, the acronym table (the authority for nearly every expansion the game uses).
- `ASK 5.0a Mission Systems Interface Volume.txt` — ~10.5k lines. DMS lifecycle, PNT, sensors, link-health messages.
- `ASK 5.0a Vehicle Interface Volume.txt` — ~8.6k lines. VI control modes, FA responsibilities.

**Not present on this device:** the **Command and Control** and **Peer** Interface Volumes. They hold
the RBAC role definitions, the approval/designation weapon flow, and the leader-election methods — so
those parts of the game rest on design-set assertion, not primary text. **But mine the XSD before
assuming a claim is uncheckable:** it is normative for *enumerations and field semantics*, not just
message-type names, and searching it for the underlying concept settled six VERIFY items that had
been filed as "needs an absent volume". Everything still affected is
listed in `docs/VERIFY.md`; if you are on a machine that *does* have those volumes, work that
checklist. Do not silently upgrade an unverified claim to a sourced one.

## Design set (`docs/`) — read before changing direction
`docs/00-design-doc.md` one-pager · `01-mechanics-to-agra-mapping.md` (all `[S]` flags) ·
`02-mission-phases.md` (OV-1) · `03-failure-degradation.md` · `04-tech-and-mvp.md`. The root
`README.md` indexes them. (There is no `design/` directory — earlier revisions of this file said
there was.)

## Locked design decisions
- **Fabric = the real DMS** (Decentralized Messaging Service). One DMS instance *per platform*; the
  instances form a DDS/RTPS pub-sub mesh with **no central broker**. The board renders this as a shaded
  contested-OTA **mesh field** plus a **DMS port** on each platform — *not* a discrete central node (that
  would imply the very broker the standard says does not exist). Distinct from the on-platform **Abstract
  Service Bus (ASB)** (MA↔local-MS). Not an invented abstraction.
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
- **Leader election = four named methods** — enumerated `0`–`3` on
  `MA_LeadershipMetricsMDT.PackageLeaderElectionMethod` in the XSD: Bully / Static Fitness Score /
  Maximum Consensus / Raft. Each has a distinct message cost, run over the same degraded links that
  caused the loss. (There is no fifth; an "Off-Nominal" method earlier revisions listed had no source
  and was removed.)
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
3 ACPs (one leader) + QB, each running its own DMS instance over the DDS mesh (reroute = a second path
through a relay platform's DMS, QB→ACP-2→ACP-1); P2P COP fan-out kept under a freshness threshold;
one-shot strike approval round trip gated to the QB role with a WEZ deadline; scripted QB→leader
return-link drop → `FAIL_MISSING_ACK`. Ship **Raft + Static** election only. Out of MVP: other 4 interfaces, other phases,
team-split/re-election, dynamic ACP geometry, ROE/WEZ detail beyond one gate flag.
Build order: deterministic sim + DMS lifecycle + headless harness **first**, then RBAC gate, then COP
fan-out, then view, then param-sweep CSV.

## Dev environment
- **Browser for screenshots:** **check what is actually installed before trusting this line** — it
  has now been wrong in both directions three times. Just run
  `ls /usr/bin/google-chrome* /usr/bin/chromium*`. As of **2026-08-02**: `/usr/bin/chromium` **is**
  installed and `google-chrome-stable` is **not** (the reverse of what this line said on 2026-07-19).
  Headless screenshot: `chromium --headless --disable-gpu --hide-scrollbars --no-sandbox --virtual-time-budget=4000 --screenshot=<path> --window-size=1280,1500 <url>`
  `--virtual-time-budget` matters: without it you screenshot before the Svelte app has mounted.
  `vaInitialize failed: unknown libva error` and the `nss_util.cc … Root Certs` error are both
  harmless — ignore them.
- **Playwright:** `npx playwright` is available but has **no cached browser bundles and no
  importable `playwright-core`** — `import { chromium } from 'playwright-core'` fails with
  ERR_MODULE_NOT_FOUND. Use the headless command above instead.
- **Claude-in-Chrome MCP** is *not* connected on this machine (no browser extension). Don't plan a
  verification step around it.
- **Deep-linking the UI for screenshots:** `App.svelte` reads query params, so you can land directly
  on a view instead of scripting clicks — `?guide=<section-id>` opens the Field Guide at that
  section (ids are in `SECTIONS`, e.g. `?guide=election`). The dev/preview server serves under the
  base path `/games/servicebus/`, so the full URL is
  `http://localhost:<port>/games/servicebus/?guide=election`.

## Working conventions
- Keep the sim deterministic and headless-testable; no rendering coupling. Seeded RNG only.
- Use real A-GRA message/interaction names in code identifiers and comments where practical.
- When adding a mechanic, cite the `docs/` basis; if it's a simplification, mark it `[S]` in code and in `docs/01-mechanics-to-agra-mapping.md`.
- This is a learning project for a domain expert (aerospace SE; RF/EMC; DO-178C/DO-377A). Be precise and
  technical; surface fidelity trade-offs explicitly rather than smoothing them over.
