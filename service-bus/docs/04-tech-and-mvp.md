# Browser Tech Choice & MVP Scope

## Recommendation (firm, with rationale)

**Core simulation:** plain **TypeScript**, a **pure deterministic tick engine** with a **seeded PRNG**,
zero framework dependencies, runnable **headless** (Node) and in-browser from the same module.

**Rendering:** **SVG** for the network graph (nodes, directed links, queues) + **HTML Canvas** only if
token density on links demands it (defer). **Svelte** (via Vite) for the HUD/reactive panels.

**Why this stack:**
- **Determinism + headless is the requirement that drives everything.** You want to reason about A-GRA
  under realistic link conditions — that means running the *same* scenario thousands of times with a
  seeded RNG, sweeping `p_loss` / Gilbert–Elliott transition probs / election method, and plotting
  outcome distributions **without a browser in the loop**. So the sim must be a pure function of
  `(scenario, seed)` with no coupling to render/DOM/time. Keep `requestAnimationFrame` strictly in the
  view layer; the engine advances by integer ticks only.
- **SVG over Canvas for the graph** because nodes/links are few (≤~12) and discrete, want crisp labels,
  hit-testing, and CSS state styling for `GOOD/BAD` links and `PENDING/EXECUTING/FAIL_*` tokens. Canvas
  wins only at high particle counts — not the MVP regime.
- **Svelte over React** for a solo learning project: less boilerplate, reactive stores map cleanly onto
  "HUD reflects sim state", trivial Vite setup. (React is a fine substitute if you already know it; the
  sim core is framework-agnostic regardless.)
- **No game engine (Phaser/Pixi).** This is a graph + queues + a clock, not a sprite/physics game; an
  engine would add weight and fight the determinism requirement.

**Module shape:**
```
/sim            (pure TS, no DOM, no framework — unit-tested headless)
  rng.ts        seeded PRNG (e.g. mulberry32/xoshiro)
  link.ts       directed link + Gilbert–Elliott state, bandwidth, latency queue
  message.ts    interaction model: request+reply, DMS lifecycle state machine
  rbac.ts       roles, Target-Authority gate, REJECTED/CannotComply
  election.ts   the 5 methods as pluggable strategies (Raft/Static for MVP)
  scenario.ts   nodes, links, phase demand schedule, scoring
  engine.ts     tick(state) -> state'   (the whole game is this pure function)
/view           (Svelte + SVG; subscribes to engine snapshots)
/scenarios      JSON scenario definitions (Phase-6 MVP lives here)
/headless       Node harness: run N seeds, sweep params, dump CSV  ← your RF sandbox
```

## MVP scope (this session's slice)

**One phase, two interfaces, one contingency** — the smallest thing that teaches a true topology lesson.

**Scenario: "Threat Engagement at CAP" (Phase 6), pre-seeded with COP already flowing.**
- **Network:** 3 ACPs (one is package leader) + 1 **QB** node. Each platform runs its own DMS instance
  (no discrete relay node); the OTA region is the DMS/DDS mesh. 6 directed links.
- **Interfaces in play:** **C2** (the gated strike-approval round trip) + **P2P** (COP keep-alive fan-out
  among the 3 ACPs). VI shown as on-platform/free to make the topology point; MS/MP/MD out of MVP.
- **Demand:** (a) continuous P2P COP refresh that must stay under a freshness threshold; (b) a one-shot
  **strike approval** interaction `MA_ApprovalRequestMT → QB → MA_ApprovalRequestStatusMT(APPROVED)`
  with a deadline (the WEZ window).
- **Authority:** the approval gate is satisfiable **only by the QB role**. A red-herring AVC node, if
  routed the request, yields `REJECTED` — the teaching beat that *delivery ≠ authority*.
- **The one contingency:** at a scripted tick, the **QB→leader return link** goes BAD, so the approval
  reply stalls in **`FAIL_MISSING_ACK`**. Player must reroute (via a relay platform's DMS, QB→ACP-2→ACP-1)
  or re-request before the WEZ deadline, while not starving the COP fan-out of bandwidth.

**MVP win condition:** strike approval completes (correct round trip, QB authority, before deadline) AND
COP freshness never breached. **Loss:** deadline missed, or approval acted under wrong authority.

**Explicitly out of MVP:** the other 4 interfaces, Phases 1–5/7–8, team-split/re-election, the full
election-method roster (ship **Raft + Static** only), dynamic ACP geometry / range-driven `p_loss`,
ROE/WEZ detail beyond the single gate flag.

**Definition of done for MVP:**
1. `sim` runs headless: `node headless/run.js scenarios/phase6.json --seed 1..1000` emits a CSV of
   outcome (win/loss, completion tick, fail reason).
2. Browser view renders the 5-node graph, animates token lifecycle states, exposes the QB-link-drop
   toggle and per-link queue discipline, and shows the score.
3. A 60-second first-time-player path produces the intended "oh — *arrival isn't approval, and authority
   is checked at the destination*" realisation.

## Suggested build order
1. `sim` engine + DMS lifecycle + one link + headless harness (no UI) — prove determinism first.
2. RBAC gate + the strike round-trip; unit-test REJECTED and MISSING_ACK paths.
3. P2P COP fan-out + freshness scoring.
4. Svelte/SVG view + the QB-drop contingency toggle.
5. Parameter-sweep CSV export (your RF sandbox) — then you can start asking the real questions.
