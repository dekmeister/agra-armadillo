<script lang="ts">
import { onDestroy } from "svelte";
import Debrief from "./components/Debrief.svelte";
import DecisionCard from "./components/DecisionCard.svelte";
import EventLog from "./components/Dock/EventLog.svelte";
import Inspector from "./components/Dock/Inspector.svelte";
import Objective from "./components/Dock/Objective.svelte";
import Graph from "./components/Graph.svelte";
import Header from "./components/Header.svelte";
import Legend from "./components/Legend.svelte";
import Modal from "./components/Modal.svelte";
import { game } from "./lib/store.svelte.ts";
import type { ModalKind } from "./lib/ui.ts";

const outcome = $derived(game.gs.outcome);

// Open with "how to play" so the level is discoverable; closing it starts the mission.
let modal = $state<ModalKind | null>("help");

// The 1 Hz loop runs while no menu is open; opening a menu pauses the mission.
$effect(() => {
  if (modal) game.stop();
  else game.start();
});
onDestroy(() => game.stop());
</script>

<main>
  <Header onOpen={(k) => (modal = k)} />
  <div class="legendbar"><Legend /></div>

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
  .legendbar { display: flex; justify-content: center; padding: 2px 0 6px; }
  .body { flex: 1; display: flex; gap: 18px; padding: 0 22px 18px; min-height: 0; }
  .left { width: 320px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
  .stage { flex: 1; min-width: 0; min-height: 0; }
  .side { width: 400px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
</style>
