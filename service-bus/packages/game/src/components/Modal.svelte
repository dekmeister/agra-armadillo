<script lang="ts">
  import type { ModalKind } from "../lib/ui.ts";
  let { kind, onClose }: { kind: ModalKind; onClose: () => void } = $props();

  const titles: Record<ModalKind, string> = {
    levels: "Missions",
    background: "Background — A-GRA & the Abstract Service Bus",
    help: "How to play",
  };
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<div
  class="backdrop"
  onclick={onClose}
  onkeydown={(e) => (e.key === "Enter" || e.key === " ") && onClose()}
  role="button"
  tabindex="-1"
  aria-label="Close"
></div>

<div class="modal card" role="dialog" aria-modal="true" aria-label={titles[kind]}>
  <div class="mhead">
    <h2>{titles[kind]}</h2>
    <button class="x" onclick={onClose} aria-label="Close">✕</button>
  </div>

  <div class="body">
    {#if kind === "levels"}
      <p class="lead">One mission is available in this prototype. Future missions will unlock here,
        overlaid on the OV-1 operational view.</p>
      <button class="level" onclick={onClose}>
        <span class="num">01</span>
        <span class="ldetail">
          <span class="ltitle">Threat Engagement at CAP</span>
          <span class="lsub">OV-1 Phase 6 · interfaces C2 + P2P · one contingency</span>
          <span class="lblurb">Push a deadline-critical strike-approval reply through a degraded
            return link before the WEZ window closes.</span>
        </span>
        <span class="play">Resume ▸</span>
      </button>
      <div class="locked">
        <span class="num">02–08</span>
        <span class="ldetail"><span class="ltitle">Launch · Transit · CAP · RTB · …</span>
          <span class="lsub">locked — the other OV-1 phases</span></span>
      </div>

    {:else if kind === "background"}
      <p>A-GRA is a reference architecture for collaborative military autonomy (ASK 5.0a, building on
        UCI 2.5). This game models its <b>topology and message-flow layer</b> — who talks to whom, over
        which interface, gated by what.</p>
      <h3>The Abstract Service Bus (ASB / DMS)</h3>
      <p>Platforms exchange messages over the real <b>Decentralized Messaging Service</b> — the fabric
        the board renders. Each message is part of an <b>interaction</b>: a request plus its required
        status reply (a round trip). The round trip is the unit compliance is assessed at, and its
        return leg can fail independently.</p>
      <h3>The six L1 interfaces</h3>
      <p><b>C2</b> command/control · <b>P2P</b> peer-to-peer (team & COP) · <b>MS</b> mission systems /
        DMS relay · <b>VI</b> vehicle interface · <b>MP</b> mission plan · <b>MD</b> mission data.
        Only C2, P2P and MS/COP updates cross the contested air; VI and local sensor reads stay
        on-platform and reliable.</p>
      <h3>Nodes & authority</h3>
      <p><b>ACP</b> — an autonomous platform running Mission Autonomy. <b>QB</b> — the command node and
        Target Authority for weapon employment. <b>DMS</b> — the messaging relay. Authority is governed
        by five RBAC roles (<b>Admin · QB · AVC · LRE · Observer</b>) and is checked <b>at the
        destination</b>: a message arriving somewhere does not make that node authorised.</p>

    {:else}
      <h3>The situation</h3>
      <p>ACP-1 (the team leader) has asked the QB to approve a strike. The QB <b>approved it</b> — but
        the QB→ACP-1 return link has gone <b>BAD</b> (bursty/lossy), so the approval reply is stuck in
        <b>MISSING_ACK</b>: sent, but never confirmed. <i>Delivery ≠ approval</i> — the reply has to
        actually arrive, on time, with verified QB authority.</p>
      <h3>Your goal</h3>
      <p>Get the reply delivered before the <b>WEZ window</b> counts down to zero, without letting COP
        freshness collapse. Your first click anywhere starts the clock.</p>
      <h3>What to try</h3>
      <ol>
        <li><b>Re-prioritise the link.</b> Click the amber dashed <b>QB→ACP-1</b> link, then set its
          queue order to <b>Deadline</b> or <b>Class</b> so the reply jumps ahead of routine traffic.</li>
        <li><b>Reroute.</b> Click the stalled reply token (the spinning red “?”) and send it via the
          <b>DMS relay</b> — reliable, but slower.</li>
        <li><b>Re-request</b> issues a fresh approval — but onto the same BAD link, so on its own it’s
          usually not enough.</li>
      </ol>
      <h3>Reading the board</h3>
      <p><b>Square = C2</b>, <b>circle = P2P</b>. Grey line = GOOD link, amber marching dashes = BAD.
        A gold seal marks verified authority. Badges on nodes show queue depth.</p>
      <p class="win">Win: reply delivered + QB authority verified before the deadline.<br />
        Lose: deadline missed, or approval acted on under the wrong authority.</p>
    {/if}
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(27, 31, 36, 0.32); z-index: 40; border: none; }
  .modal {
    position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(640px, 92vw); max-height: 84vh; display: flex; flex-direction: column; padding: 0;
  }
  .mhead {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px 12px; border-bottom: 1px solid var(--hair);
  }
  .mhead h2 { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
  .x { border: none; background: var(--seg-track); width: 30px; height: 30px; border-radius: 8px; font-weight: 700; color: var(--sub); }
  .body { overflow-y: auto; padding: 16px 22px 22px; font-size: 13.5px; line-height: 1.5; color: #34383e; }
  .body h3 { font-size: 13px; font-weight: 800; margin: 16px 0 4px; letter-spacing: 0.2px; }
  .body p { margin: 6px 0; }
  .body ol { margin: 6px 0; padding-left: 20px; }
  .body li { margin: 5px 0; }
  .lead { color: var(--sub); }
  .level, .locked {
    display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
    border: 1px solid var(--hair); border-radius: 14px; padding: 14px 16px; margin-top: 12px; background: #fff;
  }
  .level { cursor: pointer; }
  .level:hover { border-color: var(--c2); }
  .locked { opacity: 0.5; }
  .num { font-size: 20px; font-weight: 800; color: var(--c2); min-width: 56px; }
  .locked .num { color: var(--sub); font-size: 14px; }
  .ldetail { display: flex; flex-direction: column; flex: 1; }
  .ltitle { font-weight: 800; font-size: 14px; }
  .lsub { font-size: 11px; color: var(--sub); font-weight: 600; }
  .lblurb { font-size: 12px; color: #34383e; margin-top: 3px; }
  .play { font-weight: 800; color: var(--c2); }
  .win { margin-top: 14px; padding: 10px 12px; background: var(--tint-green); border-radius: 10px; font-weight: 600; }
</style>
