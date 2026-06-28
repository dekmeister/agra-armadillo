# Service Bus — Design Set (A-GRA ASK 5.0a)

A browser routing/throughput game teaching A-GRA's **topology and message-flow layer**: which
interactions flow over which of the six L1 interfaces, between which nodes, gated by what, under what
link conditions. Third of three A-GRA learning games (the others teach VI deeply and the compliance
regime).

| Doc | Contents |
|---|---|
| [00-design-doc.md](00-design-doc.md) | One-page design document |
| [01-mechanics-to-agra-mapping.md](01-mechanics-to-agra-mapping.md) | Mechanics → A-GRA mapping table, with all simplifications flagged |
| [02-mission-phases.md](02-mission-phases.md) | Mission-phase structure derived from the OV-1 DCA vignette |
| [03-failure-degradation.md](03-failure-degradation.md) | Link model, DMS lifecycle, contingencies, election-under-degradation |
| [04-tech-and-mvp.md](04-tech-and-mvp.md) | Browser tech choice + MVP scope (Phase 6, C2+P2P, one contingency) |

**Source standards:** `../docs/` — Start Here Guide + C2 / Mission Systems / Peer Interface Volumes (ASK 5.0a).

**Guard rail:** abstract message *content* freely; never misrepresent message *topology* — who talks to
whom, over which interface, gated by what. Every simplification is flagged `[S]` in doc 01.

**Key grounding wins (real, not invented):**
- The "fabric" is the real **DMS (Decentralized Messaging Service)** / Abstract Service Bus (ASB).
- Cargo = **interactions** (request+required-status round trips), the unit A-GRA compliance is assessed at.
- Failure vocabulary is the real DMS lifecycle: `PENDING→EXECUTING→SENT/FAIL_UNSENT/FAIL_MISSING_ACK`.
- **Not all six interfaces cross the contested air** — VI (MA↔FA) is on-platform; corrects a topology error
  in the initial concept.
- Five RBAC roles (Admin/QB/AVC/LRE/Observer) gate command authority at the destination.
- Five named leader-election methods (Bully/Raft/Static-Fitness/Max-Consensus/Off-Nominal) modelled with
  distinct message costs under burst (Gilbert–Elliott) link loss.

## MVP build (Phase 6 vertical slice)

A deterministic, headless-testable sim core drives a Svelte + SVG console (Direction-B handoff).

```
packages/core   pure TS sim — tick(state)->state', seeded PRNG, DMS lifecycle, RBAC, links   (no DOM)
packages/game   Svelte + SVG mission console, wired to live core snapshots                    (Vite)
scenarios/      phase6.json — the MVP scenario tunables
tools/          run-sweep.ts — headless seed sweep -> CSV (the "RF sandbox")
```

```sh
npm install
npm test                                   # core unit tests (determinism, RBAC, contingency, scoring)
npm run typecheck                           # tsc across core + tools
npm run sweep -- scenarios/phase6.json --compare --seeds 500   # win-rate by recovery strategy
npm run dev                                 # the playable console (http://localhost:5174/games/servicebus/)
```

The emergent lesson (from the sweep): doing nothing (FIFO) wins ~28%; re-prioritising the BAD link
(EDF/Class) ~90%; rerouting via the DMS relay ~95%; **re-requesting onto the same BAD link ~22%** — i.e.
*delivery ≠ approval*, *authority is checked at the destination*, and routing/queue discipline — not
retrying — is what gets the deadline-critical reply through.
