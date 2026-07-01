<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Debrief from "./components/Debrief.svelte";
import DecisionCard from "./components/DecisionCard.svelte";
import EventLog from "./components/Dock/EventLog.svelte";
import Inspector from "./components/Dock/Inspector.svelte";
import Objective from "./components/Dock/Objective.svelte";
import Graph from "./components/Graph.svelte";
import Header from "./components/Header.svelte";
import Modal from "./components/Modal.svelte";
import { game } from "./lib/store.svelte.ts";
import type { ModalKind } from "./lib/ui.ts";

const outcome = $derived(game.gs.outcome);

// Open on the mission picker so the player chooses a level; Play loads it and starts.
let modal = $state<ModalKind | null>("levels");

// Deep-link: `?level=phaseN` loads that level directly and skips the picker (handy for
// sharing a mission and for headless screenshots).
onMount(() => {
  const p = new URLSearchParams(window.location.search).get("level");
  if (p && /^phase[1-8]$/.test(p)) {
    game.load(p);
    modal = null;
  }
});

// The 1 Hz loop runs while no menu is open; opening a menu pauses the mission.
$effect(() => {
  if (modal) game.stop();
  else game.start();
});
onDestroy(() => game.stop());
</script>

<main>
  <Header onOpen={(k) => (modal = k)} />

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

{#if modal}
  <Modal kind={modal} onClose={() => (modal = null)} />
{/if}

{#if outcome !== "pending"}
  <Debrief />
{/if}

<style>
  main { width: 100vw; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .body { flex: 1; display: flex; gap: 18px; padding: 8px 22px 18px; min-height: 0; }
  .left { width: 320px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
  .stage { flex: 1; min-width: 0; min-height: 0; }
  .side { width: 400px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
</style>
