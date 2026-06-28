<script lang="ts">
import { onDestroy } from "svelte";
import EventLog from "./components/Dock/EventLog.svelte";
import Inspector from "./components/Dock/Inspector.svelte";
import Objective from "./components/Dock/Objective.svelte";
import Graph from "./components/Graph.svelte";
import Header from "./components/Header.svelte";
import Legend from "./components/Legend.svelte";
import Modal from "./components/Modal.svelte";
import { game } from "./lib/store.svelte.ts";
import type { ModalKind } from "./lib/ui.ts";

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
    <section class="stage">
      <div class="obj-overlay"><Objective /></div>
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

<style>
  main { width: 100vw; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .legendbar { display: flex; justify-content: center; padding: 2px 0 6px; }
  .body { flex: 1; display: flex; gap: 18px; padding: 0 22px 18px; min-height: 0; }
  .stage { flex: 1; position: relative; min-width: 0; min-height: 0; }
  .obj-overlay { position: absolute; top: 8px; left: 8px; width: 320px; z-index: 5; }
  .side { width: 400px; flex: none; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
</style>
