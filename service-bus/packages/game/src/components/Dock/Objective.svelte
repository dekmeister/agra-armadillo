<script lang="ts">
  import { getScenario } from "@service-bus/core";
  import { game } from "../../lib/store.svelte.ts";

  const gs = $derived(game.gs);
  const def = $derived(getScenario(gs.scenarioId));
  const status = $derived(gs.objective);
  // Status pill + note derive from the generic objective/outcome; the failReason (when
  // set by the level) carries the specific "why".
  const meta = $derived(
    status === "complete"
      ? { pill: "RESOLVED", tone: "good", note: "Objective complete." }
      : status === "missed"
        ? { pill: "FAILED", tone: "bad", note: gs.failReason ?? "Objective failed." }
        : gs.outcome === "win"
          ? { pill: "RESOLVED", tone: "good", note: "Objective complete." }
          : {
              pill: status === "stalled" ? "STALLED" : "IN PROGRESS",
              tone: "amber",
              note: gs.failReason ?? "Mission running — act at each decision point.",
            },
  );
</script>

<div class="card obj">
  <div class="row">
    <span class="caps">Objective · OV-1 Phase {def.phase}</span>
    <span class="pill {meta.tone}">{meta.pill}</span>
  </div>
  <div class="title">{def.title}</div>
  <div class="auth">authority is checked at the destination · arrival ≠ effect</div>
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
