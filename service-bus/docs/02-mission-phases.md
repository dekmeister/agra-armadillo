# Mission-Phase Structure (derived from the Start Here Guide OV-1)

The OV-1 DCA vignette is the campaign spine. Each phase **activates a different mix of L1 interfaces**
and stresses a different part of the network — so the phase progression *is* the curriculum. Phases are
quoted/paraphrased from Start Here Guide §"Operational View-1".

| # | Phase (OV-1) | What happens | Interfaces in play (★ = dominant) | Key real interactions | Dominant link stress |
|---|---|---|---|---|---|
| 1 | **Launch** | ACPs take off under **LRE** oversight | ★C2 (LRE role), VI, MS-PNT | LRE-authorised takeoff cmds; VI mode = Waypoint/HSA; PNT init | Low — LRE link is short-range/clean. Teaches: **LRE role authority** is narrow. |
| 2 | **Hold** | Fly a hold pattern, await **QB** arrival | VI★, MS, light C2 | Vehicle state (VI, on-board); periodic status to LRE | Idle baseline — establishes "VI is free, OTA costs". |
| 3 | **Team formation** | Assigned to a team; **package formed, leader elected** | ★P2P, C2 | Peer Joining a Package; **Leader Election** (chosen method); `MA_PackageManagementCommandMT` | First real P2P load. Teaches election message cost. |
| 4 | **Transit** | Transit **in formation** to Mission Area | ★P2P, VI, C2 | Provide/Receive Formation Status; Respond to Command from Team Lead; COP seed | Sustained P2P heartbeat + formation keeping. |
| 5 | **CAP** | Allocate zone coverage, fly **Combat Air Patrol** | ★P2P (COP), MS★, C2 | Synchronize Global COP to Peer; Distribute Sensor Track Data; zone allocation | **COP fan-out bandwidth** — the throughput core. |
| 6 | **Threat Engagement** | MA forwards strike request to **QB**; QB approves; team **self-nominates a shooter**, engages, returns to CAP | ★C2 (gated), ★P2P, MS, VI | `MA_ApprovalRequestMT→QB→MA_ApprovalRequestStatusMT`; ROE activate (`MA_RulesOfEngagementCommandMT`) propagated lead→followers; designation path | **Gated round-trip under time pressure** — the dramatic peak. **(MVP target.)** |
| 7 | **RTB @ Bingo** | At **Bingo Fuel**, request RTB to primary/alternate site; **sense-and-avoid** deconfliction | ★C2 (LRE/alt), VI★, P2P | RTB request to LRE; VI Curve/Waypoint following for the avoid maneuver; package departs → re-allocate | Hand-back of authority C2→LRE; thinning team. |
| 8 | **Land** | Land at designated airfield | ★C2 (LRE), VI | LRE-authorised landing; VI final approach modes | Returns to clean short link; mission scored. |

## Reading the curriculum
- **Interfaces are introduced one stress at a time:** VI-is-free (1–2) → P2P forms & heartbeats (3–4) →
  COP throughput (5) → gated C2 round-trip + ROE propagation (6) → authority hand-back (7–8).
- **Authority moves across the mission:** LRE owns launch/recovery; the QB owns the fight; AVC roles fly
  tasks but can't release weapons. The same network carries all of it — the *gating* is what changes.
- **Each phase has a contingency variant** (see `03-failure-degradation.md`) that can be toggled to turn a
  teaching phase into a drama phase (e.g. Phase 6 + "QB goes silent on the return leg").

## Phase → contingency affinity (where each failure bites hardest)
| Phase | Natural contingency |
|---|---|
| 3 Team formation | Election split-brain / a peer can't be reached during forming |
| 5 CAP | COP starvation — fan-out can't keep all nodes fresh within budget |
| 6 Engagement | **QB link drop on the approval return leg** (`FAIL_MISSING_ACK`); peer lost mid-fight → re-elect |
| 7 RTB | Alternate-site fallback when primary LRE link is unreachable |

This phase table is the campaign scaffold; the MVP implements **Phase 6 only**, with Phases 5→6 as the
minimal context (COP must already be flowing before the strike).
