<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Debrief from "./components/Debrief.svelte";
import DecisionCard from "./components/DecisionCard.svelte";
import EventLog from "./components/Dock/EventLog.svelte";
import Inspector from "./components/Dock/Inspector.svelte";
import Objective from "./components/Dock/Objective.svelte";
import FieldGuide from "./components/FieldGuide.svelte";
import Graph from "./components/Graph.svelte";
import Header from "./components/Header.svelte";
import Modal from "./components/Modal.svelte";
import { game } from "./lib/store.svelte.ts";
import { progress } from "./lib/progress.svelte.ts";
import { SECTIONS } from "./lib/fieldguide.ts";
import type { OverlayKind } from "./lib/ui.ts";

const outcome = $derived(game.gs.outcome);

// Open on the mission picker so the player chooses a level; Play loads it and starts.
// One piece of state for every overlay (card modals and the full-page Field Guide),
// so the pause effect below covers all of them without special-casing.
let overlay = $state<OverlayKind | null>("levels");

// Which Field Guide section to open on. Set by the `?guide=<id>` deep link.
let guideSection = $state("architecture");

// Persist per-level completion on a win (view-layer only — keeps the core pure and
// localStorage out of the tick hot path). Idempotent, so re-running on the same win is fine.
$effect(() => {
  if (game.gs.outcome === "win") progress.markWon(game.scenarioId);
});

// Deep links (handy for sharing, and for headless screenshots):
//   ?level=phaseN  — load that level directly and skip the picker
//   ?guide         — open the Field Guide, optionally at ?guide=<sectionId>
onMount(() => {
  const q = new URLSearchParams(window.location.search);
  const p = q.get("level");
  if (p && /^phase[1-8]$/.test(p)) {
    game.load(p);
    overlay = null;
  }
  if (q.has("guide")) {
    const s = q.get("guide");
    if (s && SECTIONS.some((x) => x.id === s)) guideSection = s;
    overlay = "fieldguide";
  }
});

// The 1 Hz loop runs while no overlay is open; opening one pauses the mission, so
// reading the Field Guide mid-mission never costs the player WEZ time.
$effect(() => {
  if (overlay) game.stop();
  else game.start();
});
onDestroy(() => game.stop());
</script>

<main>
  <Header onOpen={(k) => (overlay = k)} />

  <div class="body">
    <!-- Permanent left column: objective on top, the decision window below. Always
         mounted so the graph width never shifts when a beat fires/resumes. -->
    <aside class="left">
      <Objective />
      <DecisionCard />
    </aside>
    <section class="stage">
      <Graph />
    </section>
    <aside class="side">
      <Inspector />
      <EventLog />
    </aside>
  </div>
</main>

{#if overlay === "fieldguide"}
  <FieldGuide initial={guideSection} onClose={() => (overlay = null)} />
{:else if overlay}
  <Modal kind={overlay} onClose={() => (overlay = null)} />
{/if}

{#if outcome !== "pending"}
  <Debrief onMissions={() => (overlay = "levels")} />
{/if}

<style>
  main { width: 100vw; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .body { flex: 1; display: flex; gap: 18px; padding: 8px 22px 18px; min-height: 0; }
  .left { width: 320px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
  .stage { flex: 1; min-width: 0; min-height: 0; }
  .side { width: 400px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
</style>
