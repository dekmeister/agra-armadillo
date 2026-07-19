<script lang="ts">
  // The board's full key. Classes are driven from `palette.ts` (the same map Graph
  // renders from), so a new interface class cannot appear on the board without appearing
  // here — `palette.test.ts` and `legend-coverage.test.ts` pin that. WP4.3: before this,
  // the legend listed 2 of the 6 classes and omitted node rings, the DMS port, the count
  // badge and the self-loop entirely.
  import { CLASS_DESC, CLASS_FILL, CLASSES, SHAPE } from "../lib/palette.ts";
</script>

<div class="legend card">
  <div class="grp">
    <span class="caps">Interface class</span>
    {#each CLASSES as c (c)}
      <span class="item">
        <span class="sw" class:sq={SHAPE[c] === "square"} style:background={CLASS_FILL[c]}></span>
        {c}<span class="gloss">{CLASS_DESC[c]}</span>
      </span>
    {/each}
  </div>
  <div class="grp">
    <span class="caps">The air</span>
    <span class="item"><span class="mesh"></span>OTA field — contested</span>
    <span class="item"><span class="mesh clean"></span>OTA field — uncontested</span>
    <span class="item"><span class="loop"></span>self-loop = on-platform (outside the field)</span>
    <span class="item"><span class="port"></span>DMS port — where a platform meets the air</span>
  </div>
  <div class="grp">
    <span class="caps">Link</span>
    <span class="item"><span class="ln good"></span>GOOD</span>
    <span class="item"><span class="ln bad"></span>CONTESTED (marching)</span>
    <span class="item"><span class="ln ms"></span>MS relay rail</span>
    <span class="item"><span class="ln sel"></span>selected</span>
  </div>
  <div class="grp">
    <span class="caps">Node</span>
    <span class="item"><span class="ring gold"></span>authority (QB / LRE)</span>
    <span class="item"><span class="ring"></span>platform</span>
    <span class="item">★ LEADER</span>
  </div>
  <div class="grp">
    <span class="caps">State</span>
    <span class="item"><span class="badge"></span>queued (count; amber at 3+)</span>
    <span class="item"><span class="d" style:background="var(--green)"></span>SENT</span>
    <span class="item"><span class="d" style:background="var(--amber)"></span>MISSING_ACK</span>
    <span class="item"><span class="d" style:background="var(--c2)"></span>REROUTED</span>
    <span class="item"><span class="d" style:background="var(--red)"></span>FAIL</span>
    <span class="item"><span class="d gold" style:background="var(--gold)"></span>authority verified</span>
  </div>
</div>

<style>
  .legend {
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px 14px;
    font-size: 11.5px; font-weight: 600; box-shadow: var(--shadow-chip); width: 100%;
  }
  .grp { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .grp .caps { flex-basis: 100%; }
  .item { display: inline-flex; align-items: center; gap: 5px; }
  .gloss { color: var(--sub); font-weight: 500; }
  .sw { width: 12px; height: 12px; border-radius: 50%; }
  .sw.sq { border-radius: 3px; }
  .d { width: 12px; height: 12px; border-radius: 50%; }
  .ln { width: 20px; height: 4px; border-radius: 2px; }
  .ln.good { background: var(--good); }
  .ln.bad { background: var(--bad); }
  .ln.ms { background: var(--ms-rail); height: 2px; }
  .ln.sel { background: var(--c2); opacity: 0.45; height: 8px; }
  .mesh { width: 14px; height: 12px; border-radius: 3px; background: var(--mesh-fill);
    border: 1.5px dashed var(--mesh-stroke); }
  .mesh.clean { background: var(--mesh-fill-clean); border-color: var(--mesh-stroke-clean); }
  .loop { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--vi); }
  .port { width: 9px; height: 9px; border-radius: 50%; background: #fff;
    border: 2px solid var(--c2); }
  .ring { width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--ink); }
  .ring.gold { border-color: var(--gold); }
  .badge { width: 12px; height: 12px; border-radius: 50%; background: var(--tint-amber);
    border: 1.5px solid var(--amber); }
</style>
