# Service Bus — One-Page Design Document

**Working title:** Service Bus  ·  **Genre:** routing / throughput (Factorio-logistics × Mini Metro)
**Teaches:** A-GRA's *topology and message-flow layer* — which interactions flow over which of the
six L1 interfaces, between which nodes, gated by what, under what link conditions.
**Grounded in:** A-GRA ASK 5.0a (Start Here Guide, C2 / Mission Systems / Peer Interface Volumes),
built on UCI 2.5.

## One-sentence pitch
You operate the **Decentralized Messaging Service (DMS)** — A-GRA's real "Abstract Service Bus" —
for a package of ACPs flying the Start Here Guide's DCA vignette, deciding how mission-critical
*interactions* (not raw packets) traverse a contested, directional, bandwidth-limited RF network so
the right message reaches the right node, with the right authority, in time.

## Why this game (vs. the other two A-GRA games)
- The VI game teaches **one interface deeply**. The compliance game teaches **the assessment regime**.
- Service Bus teaches **the shape of the ecosystem**: the six L1 interfaces as distinct traffic classes,
  the four-ish C2 node types and their role-gated authority, P2P survival under partition, and the
  weapon-employment flow as a *separately gated* path. You internalise the taxonomy by routing it.

## Core loop (one mission, played in phases)
1. **Pre-mission:** load the Mission Data Package (MP), set the **leader-election policy** (Bully / Raft /
   Static Fitness / Max-Consensus), declare C2 node roles (RBAC), and provision the network.
2. **Per phase:** the mission generates *interaction demand* (e.g. "distribute COP to team",
   "approve strike"). Each demand is a **message sequence** — a request and its required status reply —
   that must complete over the link graph within a deadline.
3. **You route & schedule** interactions across directional links with bandwidth, latency, intermittency,
   and loss. The DMS per-message lifecycle (`PENDING→EXECUTING→SENT/FAIL_UNSENT/FAIL_MISSING_ACK`)
   is the literal success/failure model.
4. **Contingencies fire** (link drop, QB goes silent, peer lost → team split). The mission **degrades or
   succeeds** based on which interactions completed, with the right authority, in time.

## The four architectural truths the mechanics must carry (guard rail)
1. **Cargo = the six L1 interfaces as traffic classes** (C2, VI, MS, MP, MD, P2P). Routing them teaches
   the taxonomy.
2. **C2 has three paradigms** (Direct / Planned-Indirect / Responsive) issued by **C2 nodes that declare
   RBAC roles** (Admin, QB, AVC, LRE, Observer). *Delivery is necessary but not sufficient — provenance
   (role) is checked at MA. Not every commander may command every thing.*
3. **P2P carries team formation, leader election, and COP sharing, and must survive degraded links** —
   including partition into two packages and re-election.
4. **Weapon employment is a distinct, gated flow** through a **Target Authority** (the QB):
   `MA_ApprovalRequestMT → QB → MA_ApprovalRequestStatusMT(APPROVED)`, or the
   `MA_DesignationRequestMT → MA_DesignationMT` designation path.

> **Topology guard rail (non-negotiable):** the game abstracts message *content* heavily but must never
> misrepresent message *topology*. Critically: **not all six interfaces cross the contested air.** VI
> (MA↔Flight Autonomy) and local sensor reads are **on-platform and reliable**; only C2, P2P, MS-DMS/COP
> fusion, and MP/MD *updates* traverse the OTA link and feel bandwidth/latency/loss. The original
> "vehicle state flows over VI across the network" framing is topologically wrong and is corrected here.

## Win / loss
Mission **score = interactions completed correctly and on time**, mirroring A-GRA's interaction-level
compliance. Hard failures: an unauthorised role's command silently dropped; a strike approval that
times out on its return leg; a leaderless sub-team that never re-elects. Soft degradation: stale COP,
late tasking, dropped status reports.

## MVP (this session's target slice)
**One phase (Threat Engagement at CAP), two interfaces (C2 + P2P), one contingency (QB link drop on the
approval return leg).** See `04-tech-and-mvp.md`.
