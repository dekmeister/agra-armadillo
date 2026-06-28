<script lang="ts">
  import { game } from "../../lib/store.svelte.ts";

  const gs = $derived(game.gs);
  const status = $derived(gs.objective);
  const meta = $derived(
    status === "complete"
      ? { pill: "RESOLVED", tone: "good", note: "Reply delivered with verified QB authority." }
      : status === "missed"
        ? { pill: "FAILED", tone: "bad", note: "WEZ window closed before the reply was confirmed." }
        : { pill: "STALLED", tone: "amber", note: "Reply stalled on QB→ACP-1 (BAD) · MISSING_ACK." },
  );
</script>

<div class="card obj">
  <div class="row">
    <span class="caps">Objective</span>
    <span class="pill {meta.tone}">{meta.pill}</span>
  </div>
  <div class="title">Strike approval</div>
  <div class="auth"><span class="key">⚿</span> needs <b>QB authority</b> · delivery ≠ authority</div>
  <div class="note {meta.tone}">{meta.note}</div>
</div>

<style>
  .obj { padding: 12px 14px; }
  .row { display: flex; justify-content: space-between; align-items: center; }
  .pill { font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 999px; color: #fff; }
  .pill.good { background: var(--green); }
  .pill.bad { background: var(--red); }
  .pill.amber { background: var(--amber); }
  .title { font-size: 17px; font-weight: 800; letter-spacing: -0.4px; margin: 4px 0 2px; }
  .auth { font-size: 11px; color: var(--sub); }
  .key { color: var(--gold); font-weight: 800; }
  .note { margin-top: 8px; font-size: 11.5px; font-weight: 700; line-height: 1.35; }
  .note.good { color: var(--green); }
  .note.bad { color: var(--red); }
  .note.amber { color: var(--amber); }
</style>
