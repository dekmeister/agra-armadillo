<script lang="ts">
import { game } from "../../lib/store.svelte.ts";

const gs = $derived(game.gs);
let box: HTMLDivElement | undefined = $state();

// Auto-scroll to the newest line whenever the log grows.
$effect(() => {
  void gs.log.length;
  if (box) box.scrollTop = box.scrollHeight;
});
</script>

<div class="card pad logcard">
  <div class="head">
    <span class="caps">Event log</span>
    <span class="live">● live</span>
  </div>
  <div class="lines" bind:this={box}>
    {#each gs.log as l, i (i)}
      <div class="line {l.severity}">
        <span class="ts">T+{l.tick}</span>{l.text}
      </div>
    {/each}
  </div>
</div>

<style>
  .logcard { flex: 0.8; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .pad { padding: 16px 18px; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .live { font-size: 10px; font-weight: 700; color: var(--green); }
  .lines { overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
  .line { font-size: 11.5px; font-weight: 600; color: var(--sub); line-height: 1.35; }
  .ts { color: var(--faint); font-weight: 700; margin-right: 7px; }
  .line.degrade { color: var(--amber); font-weight: 700; }
  .line.success { color: var(--green); font-weight: 700; }
  .line.fail { color: var(--red); font-weight: 800; }
</style>
