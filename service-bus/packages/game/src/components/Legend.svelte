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
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px 14px;
    font-size: 11.5px; font-weight: 600; box-shadow: var(--shadow-chip);
  }
  .legend { width: 100%; }
  .grp { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .grp .caps { flex-basis: 100%; }
  .item { display: inline-flex; align-items: center; gap: 5px; }
  .div { display: none; }
  .sq { width: 12px; height: 12px; border-radius: 3px; }
  .ci, .d { width: 12px; height: 12px; border-radius: 50%; }
  .ln { width: 20px; height: 4px; border-radius: 2px; }
  .ln.good { background: var(--good); }
  .ln.bad { background: var(--bad); }
  .mesh { width: 14px; height: 12px; border-radius: 3px; background: rgba(47, 109, 240, 0.07);
    border: 1.5px dashed rgba(47, 109, 240, 0.45); }
</style>
