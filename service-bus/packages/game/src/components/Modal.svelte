<script lang="ts">
  import { GENERIC_HELP, missionHelp } from "../lib/help.ts";
  import { type Phase, PHASES, phaseByScenario } from "../lib/phases.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { game } from "../lib/store.svelte.ts";
  import type { ModalKind } from "../lib/ui.ts";
  import OV1Map from "./OV1Map.svelte";
  let { kind, onClose }: { kind: ModalKind; onClose: () => void } = $props();

  const titles: Record<ModalKind, string> = {
    levels: "Missions",
    help: "How to play",
  };

  // The phase whose scenarioId matches the loaded level (fallback to Phase 6).
  const currentPhaseId = PHASES.find((p) => p.scenarioId === game.scenarioId)?.id ?? 6;

  // Levels picker: which OV-1 phase is highlighted. Default to the loaded one.
  let selected = $state(currentPhaseId);
  const phase = $derived(
    (PHASES.find((p) => p.id === selected) ?? PHASES[PHASES.length - 1]) as Phase,
  );

  /** Load the selected level and close the picker (starting the mission). */
  function play(): void {
    game.load(phase.scenarioId);
    onClose();
  }

  /** Play-button verb: "Resume" only for the loaded level while it's actually mid-mission;
   * "Replay" once won; "Play" otherwise. (Avoids a fresh boot reading "Resume" at T+0.) */
  function playLabel(p: Phase): string {
    const current = p.scenarioId === game.scenarioId;
    if (current && game.gs.outcome === "pending" && game.gs.tick > 0) return "Resume ▸";
    if (progress.isWon(p.scenarioId)) return "Replay ▸";
    return "Play ▸";
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<div
  class="backdrop"
  onclick={onClose}
  onkeydown={(e) => (e.key === "Enter" || e.key === " ") && onClose()}
  role="button"
  tabindex="-1"
  aria-label="Close"
></div>

<div class="modal card" class:wide={kind === "levels"} role="dialog" aria-modal="true" aria-label={titles[kind]}>
  <div class="mhead">
    <h2>{titles[kind]}</h2>
    <button class="x" onclick={onClose} aria-label="Close">✕</button>
  </div>

  <div class="body">
    {#if kind === "levels"}
      <p class="lead">Select a phase on the OV-1 operational view to read its briefing, then Play to
        load that mission. All eight OV-1 phases are playable.</p>

      <OV1Map {selected} onSelect={(id) => (selected = id)} />

      <div class="level" class:locked={!phase.playable}>
        <span class="num">{String(phase.id).padStart(2, "0")}</span>
        <span class="ldetail">
          <span class="ltitle">
            {phase.name}
            {#if progress.isWon(phase.scenarioId)}<span class="done">✓ Completed</span>{/if}
          </span>
          <span class="lsub">OV-1 Phase {phase.id} · {phase.interfaces}</span>
          <span class="lblurb">{phase.blurb}</span>
          <span class="teaches"><b>Teaches:</b> {phase.teaches}</span>
        </span>
        {#if phase.playable}
          <button class="play" onclick={play}>{playLabel(phase)}</button>
        {:else}
          <span class="lockedtag">Locked — coming soon</span>
        {/if}
      </div>

    {:else}
      {@const m = missionHelp(game.scenarioId)}
      {@const p = phaseByScenario(game.scenarioId)}
      <h3>This mission — Phase {p?.id ?? currentPhaseId}: {p?.name ?? "Threat Engagement at CAP"}</h3>
      <p>{@html m.situation}</p>
      <h4>Your goal</h4>
      <p>{@html m.goal}</p>
      <h4>What to try</h4>
      <ol>
        {#each m.tryThis as t}<li>{@html t}</li>{/each}
      </ol>
      <p class="win">{@html m.winLose}</p>

      <h3>How the game works</h3>
      {@html GENERIC_HELP}
    {/if}
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(27, 31, 36, 0.32); z-index: 40; border: none; }
  .modal {
    position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(640px, 92vw); max-height: 84vh; display: flex; flex-direction: column; padding: 0;
  }
  .modal.wide { width: min(820px, 94vw); }
  .mhead {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px 12px; border-bottom: 1px solid var(--hair);
  }
  .mhead h2 { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
  .x { border: none; background: var(--seg-track); width: 30px; height: 30px; border-radius: 8px; font-weight: 700; color: var(--sub); }
  .body { overflow-y: auto; padding: 16px 22px 22px; font-size: 13.5px; line-height: 1.5; color: #34383e; }
  .body h3 { font-size: 13px; font-weight: 800; margin: 16px 0 4px; letter-spacing: 0.2px; }
  .body h4 { font-size: 12px; font-weight: 800; margin: 12px 0 2px; color: var(--sub); letter-spacing: 0.2px; }
  .body p { margin: 6px 0; }
  .body ol { margin: 6px 0; padding-left: 20px; }
  .body li { margin: 5px 0; }
  .lead { color: var(--sub); }
  .body code { font-size: 12px; background: var(--seg-track); padding: 1px 5px; border-radius: 5px; }
  .s { color: var(--sub); font-weight: 700; font-size: 11px; }
  .level {
    display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
    border: 1px solid var(--hair); border-radius: 14px; padding: 14px 16px; margin-top: 12px; background: #fff;
  }
  .level.locked { background: var(--seg-track); }
  .num { font-size: 20px; font-weight: 800; color: var(--c2); min-width: 44px; }
  .level.locked .num { color: var(--sub); }
  .ldetail { display: flex; flex-direction: column; flex: 1; }
  .ltitle { font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .done {
    font-size: 10px; font-weight: 800; color: var(--green); background: var(--tint-green);
    padding: 2px 7px; border-radius: 999px; letter-spacing: 0.2px;
  }
  .lsub { font-size: 11px; color: var(--sub); font-weight: 600; }
  .lblurb { font-size: 12px; color: #34383e; margin-top: 3px; }
  .teaches { font-size: 11.5px; color: var(--sub); margin-top: 5px; }
  .teaches b { color: #34383e; }
  .play {
    border: none; background: var(--tint-green); color: var(--green);
    font-weight: 800; font-size: 13px; padding: 8px 14px; border-radius: 10px; white-space: nowrap;
  }
  .lockedtag { font-size: 11px; font-weight: 700; color: var(--sub); white-space: nowrap; }
  .win { margin-top: 14px; padding: 10px 12px; background: var(--tint-green); border-radius: 10px; font-weight: 600; }
</style>
