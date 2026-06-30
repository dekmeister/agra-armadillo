# Mechanics → A-GRA Concept Mapping

Every game element traces to a real A-GRA construct. **Simplifications are flagged `[S]` with the
fidelity cost stated.** The rule: abstract message *content* freely; never misrepresent *who talks to
whom, over which interface, gated by what*.

## 1. Nodes (the boxes on the board)

| Game element | A-GRA concept (real names) | Fidelity notes |
|---|---|---|
| **ACP** node | Autonomous Collaborative Platform running **Mission Autonomy (MA)** | Faithful. The MA software is the thing with the six L1 interfaces. |
| **C2 node** | A C2 application + C2 node (HMI) that **declares an RBAC role** via the Authorize sequence | Faithful. Start Here Guide OV-1 shows ~four distinct C2 nodes (LRE + primary/alternate QBs). |
| **Flight Autonomy (FA)** sub-node *inside* each ACP | FA, the safety-critical platform controller MA talks to over **VI** | Faithful, and load-bearing: FA is **on-platform**, so VI never crosses the air. |
| **DMS mesh** field + per-platform **DMS port** | **Decentralized Messaging Service** over DDS/RTPS middleware — one instance *per platform*, forming a pub-sub mesh with **no central broker** | Faithful — this *is* the bus. The board renders it as a shaded OTA field (the mesh) with a DMS port on each platform, **not** a discrete central node. `[S]` mesh collapsed to one field; each DMS to one port. |
| **Sensors / PNT** sub-nodes inside each ACP | MS sensor capabilities (AMTI/ESM/PO) and PNT Service | `[S]` Local sensor reads modelled as on-platform & cheap; real MS has rich tasking handshakes. |

## 2. Cargo (the things you route)

| Game element | A-GRA concept | Fidelity notes |
|---|---|---|
| **Interaction** = a small multi-hop shipment (request + required status reply) | A-GRA **interaction / sequence** — the unit compliance is assessed at | Faithful and important: cargo is a *round trip*, not a one-way packet. The return leg can fail independently. |
| **Cargo class / colour** = one of six L1 interfaces | **C2, VI, MS, MP, MD, P2P** | Faithful taxonomy. This is the central teaching object. |
| **Cargo payload** (abstract token, no fields) | The wrapped UCI/MA message with its required fields | `[S]` Content fully abstracted — that's the *other* games' job. Service Bus shows topology, not field population. |

### 2a. The interface traffic classes and where they actually flow (guard rail)

| Class | Endpoints (who↔who) | Crosses contested air? | Example real interactions |
|---|---|---|---|
| **C2** | C2 node ↔ MA, **OTA via DMS** | **Yes** | Direct HSA/CSA Command; `MA_RulesOfEngagementCommandMT`; `MA_ApprovalRequestMT/StatusMT` |
| **P2P** | MA ↔ MA (intra-package) | **Yes** | Leader election (`MA_LeaderUpdateRequestMT`); Synchronize Global COP to Peer; Distribute Sensor Track Data |
| **MS** | MA ↔ local sensors/PNT **and** MA ↔ DMS | **Mixed** | Sensor tasking (local); `MA_TxDataPayloadCommandMT`/`MA_RxDataPayloadMT`, `MA_CommTeamReportMT` (OTA) |
| **VI** | MA ↔ FA, **on-platform** | **No** | HSA / Waypoint / Curve following command modes; FA accept/reject; vehicle state reporting |
| **MP** | Mostly pre-loaded; C2/MP push updates | **Mostly no** (pre-load) / occasional OTA | Mission Data Package; plan activation; ROE/ROE settings |
| **MD** | On-board capture; in-flight or post debrief | **Optional, deferrable** | Debrief/replay of MA data |

> Teaching payload: a new player who tries to "route VI traffic across the QB link" should be gently
> corrected by the board — VI is internal wiring. The contested-link drama lives on **C2, P2P, and
> MS-DMS/COP**; MP is a pre-load you mostly paid for on the ground; MD is the deferrable bulk class.

## 3. Authority & gating (the customs check)

| Game element | A-GRA concept | Fidelity notes |
|---|---|---|
| **Role badge** on each C2 node | **RBAC roles**: Admin, QB, AVC, LRE, Observer | Faithful. Five initial roles. Admin can re-permission others; QB has full command but not re-permissioning; AVC = flight tasks, weapon-restricted by default; LRE = takeoff/landing; Observer = read-only. |
| **A delivered-but-rejected message** (turns red at MA) | MA checks authorisation; unauthorised → command ignored, `...StatusMT` = `REJECTED` (`CannotComply`) | Faithful and a core mechanic: *arrival ≠ effect*. Provenance is enforced at the destination. |
| **Weapon-release "approval gate"** that only a QB can satisfy | **Target Authority** + `MA_ApprovalRequestMT/StatusMT`; or `MA_DesignationRequestMT→MA_DesignationMT` | Faithful. `[S]` The full ROE machinery (Identity Matrix, WEZ, Target Custody, geozones) is collapsed to a single gate flag. Noted as simplified, not as the whole story. |
| **C2 paradigm selector** (Direct / Planned / Responsive) | The three C2 paradigms | `[S]` Modelled as a property of the C2 demand (Direct = live command now; Planned = via on-board plan; Responsive = pre-armed trigger that auto-fires when a condition is met). Mechanically: Responsive demands cost nothing in-phase but must be *pre-positioned*. |

## 4. Team & P2P mechanics

| Game element | A-GRA concept | Fidelity notes |
|---|---|---|
| **Pre-mission "election policy" dial** | The five named methods: **Bully, Maximum Consensus, Raft, Static Fitness Score, Off-Nominal** | Faithful list. Each has a real, distinct message pattern & cost (see `03-failure-degradation.md`). |
| **Leadership fitness score** on each ACP | Static vs **Dynamic Leadership Fitness Score** (dynamic keys off Comms Health) | Faithful. Ties broken by highest tail number (from heartbeat) — modelled. |
| **COP broadcast** (one-to-many P2P fan-out you must schedule) | Synchronize Global COP to Peer; Distribute Sensor Track Data for package fusion | Faithful. `[S]` COP is a single freshness value per node, not a real track picture. |
| **Team split → two packages → re-elect → optional merge** | "Multiple Peers Lost Comms with Team Leader": split keeps original PackageID; leaderless half re-forms & re-elects; stays split until commanded to merge | Faithful — this is the headline contingency. |

## 5. The bus itself (DMS lifecycle)

| Game element | A-GRA concept | Fidelity notes |
|---|---|---|
| A message token's per-hop states | `PENDING → EXECUTING → SENT` / `FAIL_UNSENT` / `FAIL_MISSING_ACK` from `MA_TxDataPayloadCommandStatusMT` | Faithful — taken verbatim from the MS volume DMS interaction. This is the failure vocabulary. |
| **Link-health readout** | `MA_CommTeamReportMT`, `MA_CommAvailableEndpointsMT` (Publish Network Endpoint Availability) | Faithful primitives; `[S]` surfaced as a simple per-link quality bar. |

## Master list of deliberate simplifications
1. **Message content abstracted to opaque tokens** — no field population (`[S]`, by design; other games cover it).
2. **ROE/WEZ/Identity-Matrix/Custody collapsed to one approval gate** (`[S]`).
3. **COP reduced to a per-node freshness scalar** (`[S]`).
4. **Local MS sensor/PNT tasking simplified to cheap on-platform reads** (`[S]`).
5. **L2 (intra-MA) interfaces omitted entirely** — A-GRA 5.0a doesn't define them yet; faithful to omit.
6. **Discrete tick simulation**, not continuous RF — but link metrics (BW/latency/loss/intermittency) are
   first-class and tunable (`[S]`, and the point of the RF-fidelity work; see `03`).

## MVP implementation notes (Phase 6 vertical slice — `packages/core`)
These `[S]` choices were introduced while building the playable MVP; each is reflected in code comments.
7. **Loss split into two probabilities** for clarity: `blockGood/blockBad` (a dispatch can't get on the
   air this tick → `FAIL_UNSENT`, gated by the Gilbert–Elliott burst) and `ackLoss` (a message that left
   is never confirmed → `FAIL_MISSING_ACK`). Keeps the throughput lesson (queue policy vs. burst) distinct
   from the unconfirmed-delivery lesson. (`[S]`; refinement of master item 6.)
8. **Reply-link congestion is modelled as routine C2 traffic** (`MA_RulesOfEngagementCommandMT`) pre-seeded
   ahead of the approval reply on the QB→ACP-1 link — **kept C2-only on purpose**. The Direction-B mock
   shows a `P2P·3` backlog on that link; rendering P2P on a QB→ACP (C2) edge would mis-state topology, so
   the sim diverges from the mock to honour the guard rail. (`[S]`.)
9. **Relay reroute** of the stalled reply is modelled as a fixed two-hop path **QB→ACP-2→ACP-1** —
   i.e. routing through a *relay platform's* DMS instance rather than over the BAD direct hop (the
   DDS mesh routes around the failure; reliable, higher latency). Forwarding at the messaging layer is
   independent of RBAC (ACP-2 is an Observer; it forwards the already-QB-signed reply, it does not act on
   it). One of three genuinely-simulated recovery strategies (re-prioritise queue / reroute via a relay
   platform / re-request). (`[S]`.)
10. **Leader election reduced to Raft + Static stubs**, wired but not exercised in Phase 6 (no team-split
    in the MVP). The strategy seam is in place for later phases. (`[S]`; narrows master list item under §4.)
11. **WEZ = one absolute deadline tick + one authority gate**; the core deadline is a pure
    `wezDeadlineTick`. The view **arms it at mission start** (not on first click): with auto-pause
    (item 12) the clock already halts at each decision point and while a menu is open, so reading is
    free, and a "just resume through everything" run still faces a real deadline. (`[S]`; refinement of item 2.)
12. **Decision-point pacing (auto-pause "beats").** The crisis runs at 1 Hz but the view auto-pauses
    the instant the core raises a `pendingBeat` — one self-contained A-GRA lesson surfaced when its
    triggering transition first fires (`link-degraded` at the contingency, `queue-starved` under FIFO,
    `missing-ack` on the return-leg ack loss, `cop-warning` near a COP breach). The beat flag is **pure**
    (set in `engine.ts`, no RNG, no wall-clock), so headless replays and the sweep harness are
    byte-identical (they simply never `acknowledgeBeat`). This is a *legibility* layer over the existing
    transitions — it does not change message outcomes. (`[S]`; pacing/clarity only.)
13. **Clamped tutorial seed** (`scenario.TUTORIAL_SEED`, locked by `test/tutorial-seed.test.ts`). The
    view runs one curated seed on which the paused-decision flow is deterministic: do-nothing raises all
    three beats and **loses**, while EDF / Class / reroute each **win** and the re-request trap loses —
    so the lesson always lands for a first-time player. This is seed *curation*, not param-fudging: full
    Gilbert–Elliott fidelity is preserved. Honest stochastic outcomes are reserved for a `mode:
    "challenge"` (seam in place, not wired in the MVP). (`[S]`; teaching aid, no fidelity cost.)
14. **Contested-link rendering damped.** Once the contingency degrades the QB→ACP-1 link, the board
    renders it as **stably CONTESTED** rather than flickering amber/grey with every Gilbert–Elliott
    transition (the per-tick flip was unreadable). The live GOOD/BAD channel remains exact in the sim and
    in the Inspector. (`[S]`; view-only — the underlying channel is unchanged.)
15. **The COP-watch beat (`cop-warning`) is dormant under current MVP balance.** COP decays slowly and
    the leader's P2P fan-out auto-refreshes it over healthy P2P links, so it only enters the warning band
    in a long/struggling run — a quick win never sees it. Making it bite reliably needs genuine OTA P2P
    degradation (faithful, but new scenario state) and is a deliberate follow-on. (`[S]`; noted, not yet a
    live decision.)

**Nothing in this list alters topology, endpoints, interface assignment, or authority gating** — the
four things the guard rail protects.
