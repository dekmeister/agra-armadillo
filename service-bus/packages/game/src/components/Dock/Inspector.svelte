<script lang="ts">
import type { QueuePolicy } from "@service-bus/core";
import { inspect, nextDispatch } from "../../lib/sim-adapter.ts";
import { game } from "../../lib/store.svelte.ts";

const gs = $derived(game.gs);
const sel = $derived(game.sel);
const vm = $derived(inspect(gs, sel));
const link = $derived(vm.link);
const policies: QueuePolicy[] = ["class", "fifo", "edf"];
const policyLabel: Record<QueuePolicy, string> = { class: "Class", fifo: "FIFO", edf: "Deadline" };

const isP2P = $derived(link?.cls === "P2P");
const stalled = $derived(gs.objective === "stalled");
</script>

<div class="card pad insp">
  <div class="caps top">Inspector · click any node, link or message</div>
  <div class="head">
    <span class="title">{vm.title}</span>
    {#if vm.badge}<span class="badge {vm.badgeTone}">{vm.badge}</span>{/if}
  </div>
  <div class="sub">{vm.sub}</div>

  <div class="rows">
    {#each vm.rows as r (r.label)}
      <div class="srow">
        <span class="rl">{r.label}</span>
        <span class="rv {r.tone ?? ''}">{r.value}</span>
      </div>
    {/each}
  </div>

  {#if link}
    <div class="seg">
      {#each policies as p (p)}
        <button class:active={link.policy === p} onclick={() => game.setPolicy(link.id, p)}>
          {policyLabel[p]}
        </button>
      {/each}
    </div>
    <div class="dispatch">next dispatch → <b>{nextDispatch(gs, link)}</b></div>
  {/if}

  <div class="actions">
    {#if link?.id === "bad" && stalled}
      <button class="primary" onclick={() => game.setPolicy("bad", "edf")}>▸ Prioritise C2 reply (push through)</button>
    {/if}
    {#if sel?.type === "token" && stalled}
      <button class="primary" onclick={() => game.reroute()}>▸ Reroute via ACP-2's DMS (QB→ACP-2→ACP-1)</button>
      <button class="ghost" onclick={() => game.rerequest()}>↻ Re-request approval</button>
    {/if}
    {#if isP2P}
      <button class="ghost" onclick={() => game.refreshCop()}>⟳ Push COP refresh via this link</button>
    {/if}
    {#if gs.outcome !== "pending"}
      <button class="ghost" onclick={() => game.replay()}>↻ Replay scenario</button>
    {/if}
  </div>
</div>

<style>
  .insp { flex: 1.4; overflow: hidden; display: flex; flex-direction: column; }
  .pad { padding: 16px 20px; }
  .top { margin-bottom: 10px; }
  .head { display: flex; align-items: center; gap: 8px; }
  .title { font-size: 19px; font-weight: 800; letter-spacing: -0.3px; }
  .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 999px; color: #fff; }
  .badge.good { background: var(--green); }
  .badge.bad { background: var(--amber); }
  .badge.blue { background: var(--c2); }
  .badge.gold { background: var(--gold); }
  .badge.neutral { background: var(--sub); }
  .sub { font-size: 12px; font-weight: 600; color: var(--sub); margin: 3px 0 6px; }
  .rows { overflow-y: auto; flex: 1; min-height: 0; }
  .srow { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--hair); }
  .rl { font-size: 13.5px; font-weight: 600; color: var(--sub); white-space: nowrap; }
  .rv { font-size: 13.5px; font-weight: 700; text-align: right; }
  .rv.good { color: var(--green); }
  .rv.bad { color: var(--red); }
  .rv.amber { color: var(--amber); }
  .rv.blue { color: var(--c2); }
  .rv.gold { color: var(--gold); }
  .seg { display: flex; background: var(--seg-track); border-radius: 11px; padding: 4px; margin-top: 14px; gap: 4px; }
  .seg button {
    flex: 1; border: none; background: transparent; border-radius: 8px; padding: 9px 0;
    font-size: 13px; font-weight: 700; color: var(--sub);
  }
  .seg button.active { background: #fff; color: var(--ink); box-shadow: var(--shadow-chip); }
  .dispatch { font-size: 12px; color: var(--sub); margin-top: 8px; }
  .dispatch b { color: var(--c2); }
  .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
  .actions button { border-radius: 10px; padding: 11px 14px; font-size: 13px; font-weight: 700; text-align: left; }
  .primary { background: var(--ink); color: #fff; border: none; }
  .ghost { background: #fff; color: var(--ink); border: 1px solid var(--hair); }
</style>
