<script lang="ts">
  // Static legend — the color-role key (class / link / state). No props.
</script>

<div class="legend card">
  <div class="grp">
    <span class="caps">Class</span>
    <span class="item"><span class="sq" style:background="var(--c2)"></span>C2</span>
    <span class="item"><span class="ci" style:background="var(--p2p)"></span>P2P</span>
  </div>
  <span class="div"></span>
  <div class="grp">
    <span class="caps">Link</span>
    <span class="item"><span class="ln good"></span>GOOD</span>
    <span class="item"><span class="ln bad"></span>BAD</span>
    <span class="item"><span class="mesh"></span>DMS mesh</span>
  </div>
  <span class="div"></span>
  <div class="grp">
    <span class="caps">State</span>
    <span class="item"><span class="d" style:background="var(--green)"></span>SENT</span>
    <span class="item"><span class="d" style:background="var(--amber)"></span>MISSING_ACK</span>
    <span class="item"><span class="d" style:background="var(--red)"></span>FAIL</span>
    <span class="item"><span class="d gold" style:background="var(--gold)"></span>authority</span>
  </div>
</div>

<style>
  .legend {
    display: inline-flex; align-items: center; gap: 16px; padding: 9px 18px;
    font-size: 12px; font-weight: 600; box-shadow: var(--shadow-chip);
  }
  .grp { display: inline-flex; align-items: center; gap: 12px; }
  .item { display: inline-flex; align-items: center; gap: 6px; }
  .div { width: 1px; height: 18px; background: var(--hair); }
  .sq { width: 12px; height: 12px; border-radius: 3px; }
  .ci, .d { width: 12px; height: 12px; border-radius: 50%; }
  .ln { width: 20px; height: 4px; border-radius: 2px; }
  .ln.good { background: var(--good); }
  .ln.bad { background: var(--bad); }
  .mesh { width: 14px; height: 12px; border-radius: 3px; background: rgba(47, 109, 240, 0.07);
    border: 1.5px dashed rgba(47, 109, 240, 0.45); }
</style>
