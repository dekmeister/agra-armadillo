# Failure & Degradation Mechanics

This is the part you (RF/C2-link background) care about professionally. The design goal: **link
degradation behaviour is plausible enough that the game is a usable sandbox for reasoning about
A-GRA behaviour under realistic link conditions** — without pretending to be a propagation simulator.

## 1. Link model (directional, per-hop)
Every link is a **directed edge** (A→B may differ from B→A — real for asymmetric power/antenna). Each
direction carries four first-class parameters, all tunable per scenario:

| Parameter | Meaning | Gameplay effect |
|---|---|---|
| **Bandwidth** (msgs or bytes / tick) | sustained throughput | hard cap; excess queues |
| **Latency** (ticks) | one-way propagation + processing | delays arrival; interacts with deadlines |
| **Loss prob.** `p_loss` | per-message independent drop | causes `FAIL_UNSENT` / `FAIL_MISSING_ACK` |
| **Intermittency** | a 2-state Gilbert–Elliott link: GOOD ↔ BAD with transition probs | models fading/jamming bursts, not iid noise |

> **RF-fidelity note:** the Gilbert–Elliott two-state Markov model is the deliberate choice over iid loss
> because real tactical links fail in *bursts* (terrain mask, fade, jam, geometry), and burst loss is what
> actually breaks round-trip interactions and heartbeat-based election. This is the knob that makes the
> sandbox say something true about A-GRA under contested comms. `[S]` It is still a coarse abstraction of
> SNR/link-budget; there is no real channel model, Doppler, or range-dependent path loss in MVP. A later
> mode can drive `p_loss`/state-transitions from a range+terrain function over the moving ACP geometry.

Queueing discipline is **player-configurable per link** (priority by interface class, FIFO, or deadline-
earliest-first) — this is the actual strategic surface of the throughput game.

## 2. Per-message lifecycle (taken verbatim from the MS-DMS interaction)
Each message token, per destination, walks the real `MA_TxDataPayloadCommandStatusMT` states:

```
PENDING ──► EXECUTING ──► SENT (delivered, ack received)
   │             │
   │             ├─► FAIL_UNSENT        (loss/lost-comms before it left the queue)
   │             └─► FAIL_MISSING_ACK   (left, but no delivery confirmation — TCP-style)
   └─► (cancel/update only legal before EXECUTING)
```

- `FAIL_UNSENT` = you find out early; cheap to retry.
- **`FAIL_MISSING_ACK` is the insidious one** and the heart of the drama: the *request* may have arrived
  and acted, but you can't know. For a **round-trip interaction** (e.g. strike approval), the return-leg
  `MISSING_ACK` means the approval may exist at the QB but never reaches MA — do you re-request (risk
  double action) or wait (risk missing the WEZ)? This is a real A-GRA decision the player feels.

## 3. Contingency catalogue (all grounded in the volumes)

| Contingency | Real basis | In-game trigger & effect | Player response |
|---|---|---|---|
| **Link drop mid-engagement** | DMS loss-of-comms → `FAIL_UNSENT` | a link goes BAD during Phase 6 | reroute via relay ACP; reprioritise queue |
| **QB goes silent** | Team Leader / C2 Lost Comms with Team Leader | approval round-trip stalls in `MISSING_ACK`; gate stays shut | fall back to **alternate QB**; or wait for re-link |
| **Peer lost** | Peer Contingencies (Triggered Contingency Alert to Peer) | a follower drops from the package | leader updates membership; reallocate its CAP zone |
| **Team split (split-brain)** | "Multiple Peers Lost Comms with Team Leader" | package partitions: leader-side keeps PackageID; orphan-side must **re-form & re-elect** | run election on orphan side; re-sync COP; merge only **on command** |
| **COP starvation** | COP/fusion can't refresh within budget | nodes' COP freshness decays → engagement quality drops | shed low-priority MD/MP; raise COP priority |
| **Unauthorised command** | RBAC: MA ignores → `REJECTED`/`CannotComply` | an AVC node's weapon command silently no-ops | route the *right interaction from the right role* (QB) |

## 4. Leader election under degradation — the strategic centrepiece
You pick the **election policy pre-mission**; when the leader is lost, the chosen method's real message
pattern plays out **over the same degraded links** that caused the loss. This couples the RF model to the
distributed-systems behaviour — exactly the A-GRA-under-contested-comms question.

| Method | Message pattern (modelled) | Bandwidth cost | Behaviour under burst loss / partition | Teaches |
|---|---|---|---|---|
| **Bully** | higher-ID nodes challenged; loser yields | ~O(n²) chatter | robust but **expensive**; can thrash if links flap | cost of strong consistency |
| **Raft** | term + heartbeat + vote; needs majority | low steady heartbeat, vote burst on timeout | clean **majority** semantics; **stalls without quorum** (good split-brain lesson) | quorum & terms |
| **Static Fitness Score** | pre-loaded scores; consensus then highest declares | very low — no negotiation of scores in-flight | **deterministic & cheap**, but **inflexible** if the fittest node is the one you lost | pre-planning vs. adaptivity |
| **Maximum Consensus** | exchange + agree on max fitness; ties → highest tail number | moderate consensus block | adapts via **dynamic** fitness (e.g. Comms Health) | dynamic fitness keyed on link health |
| **Off-Nominal** | degraded-mode election when normal preconditions fail | situational | the explicit "things are broken" path | graceful degradation |

**Dynamic Leadership Fitness Score keyed on Comms Health** is the killer interaction: the node with the
best links *should* lead, but measuring "best links" requires the links you're trying to assess. The game
lets you watch that feedback loop under Gilbert–Elliott bursts.

## 5. Scoring degradation (maps to interaction-level compliance)
- **Hard fail (0 for that interaction):** required status reply never completes within deadline; or a
  command acts under the wrong authority.
- **Soft degrade (partial):** completes late, or completes but on stale COP.
- **Mission score** = weighted sum of interactions completed correctly & on time, per phase — deliberately
  mirroring A-GRA's "correct messages, required fields, valid sequence, in time" compliance philosophy
  (content correctness is stipulated here; *topology + timing* correctness is what's scored).
