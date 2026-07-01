<script lang="ts">
import { getScenario } from "@service-bus/core";
import { copColor, mmss, wezRemaining } from "../lib/sim-adapter.ts";
import type { ModalKind } from "../lib/ui.ts";
import { game } from "../lib/store.svelte.ts";
import Legend from "./Legend.svelte";

const { onOpen }: { onOpen: (kind: ModalKind) => void } = $props();

const gs = $derived(game.gs);
const title = $derived(getScenario(gs.scenarioId).title);
const cop = $derived(Math.round(gs.cop));
const wez = $derived(wezRemaining(gs));

// The glossary/legend popout — anchored under its trigger chip, closed on outside
// click or Escape (same convention as Modal.svelte's backdrop + keydown).
let showLegend = $state(false);
// The scalar COP ring is Phase 6's mechanic; the WEZ card shows only when a deadline
// is armed. Other levels leave the HUD-right clean (their state reads on the board).
const showCop = $derived(gs.scenarioId === "phase6");
const showWez = $derived(gs.wezDeadlineTick !== null);

// COP ring arc (r15, circumference ~94.2), -90deg start.
const C = 94.2;
const offset = $derived(C * (1 - cop / 100));

const wezState = $derived(
  gs.outcome === "win" ? "win" : gs.outcome === "loss" ? "loss" : "stalled",
);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (showLegend = false)} />

<header>
  <div class="left">
    <span class="wordmark">Service&nbsp;Bus</span>
    <nav>
      <button onclick={() => onOpen("levels")}>Levels</button>
      <button onclick={() => onOpen("background")}>Background</button>
      <button onclick={() => onOpen("help")}>Help</button>
    </nav>
    <span class="phase"><span class="dot"></span>{title}</span>
    <span class="clock">T+{gs.tick}</span>
  </div>

  <div class="spacer"></div>

  <div class="hud">
    <div class="legendwrap">
      <button class="card chip" class:active={showLegend} onclick={() => (showLegend = !showLegend)}>
        Legend
      </button>
      {#if showLegend}
        <div
          class="catcher"
          onclick={() => (showLegend = false)}
          onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (showLegend = false)}
          role="button"
          tabindex="-1"
          aria-label="Close legend"
        ></div>
        <div class="popout">
          <Legend />
        </div>
      {/if}
    </div>

    {#if showCop}
    <div class="card ring">
      <svg width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r="15" fill="none" stroke="var(--hair)" stroke-width="5" />
        <circle cx="19" cy="19" r="15" fill="none" stroke={copColor(cop)} stroke-width="5"
          stroke-linecap="round" stroke-dasharray={C}
          stroke-dashoffset={offset} transform="rotate(-90 19 19)" />
      </svg>
      <div>
        <div class="caps">COP</div>
        <div class="ringval" style:color={copColor(cop)}>{cop}%</div>
      </div>
    </div>
    {/if}

    {#if showWez}
    <div class="card wez" class:win={wezState === "win"} class:loss={wezState === "loss"}>
      <div class="caps">WEZ window</div>
      {#if wezState === "win"}
        <div class="big ok">✓</div>
        <div class="sub">approval secured</div>
      {:else if wezState === "loss"}
        <div class="big bad">0:00</div>
        <div class="sub">deadline missed</div>
      {:else}
        <div class="big" class:pulse={wez !== null && wez <= 5}>{wez === null ? "0:18" : mmss(wez)}</div>
        <div class="sub">{gs.armed ? "to deadline" : "standby · click to start"}</div>
      {/if}
    </div>
    {/if}
  </div>
</header>

<style>
  header { display: flex; align-items: center; gap: 14px; padding: 16px 30px 10px; }
  .left { display: flex; align-items: center; gap: 14px; }
  .wordmark { font-size: 18px; font-weight: 800; letter-spacing: -0.4px; }
  nav { display: flex; gap: 2px; }
  nav button {
    border: none; background: transparent; border-radius: 8px; padding: 6px 11px;
    font-size: 13px; font-weight: 600; color: var(--sub);
  }
  nav button:hover { background: #fff; color: var(--ink); box-shadow: var(--shadow-chip); }
  .phase {
    display: inline-flex; align-items: center; gap: 7px; background: #fff; border-radius: 999px;
    padding: 7px 14px; font-size: 13px; font-weight: 600; box-shadow: var(--shadow-chip);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); }
  .clock { font-size: 12px; font-weight: 600; color: var(--sub); }
  .spacer { flex: 1; }
  .hud { display: flex; align-items: center; gap: 14px; }
  .legendwrap { position: relative; }
  .chip {
    border: none; background: #fff; border-radius: 999px; padding: 9px 16px;
    font-size: 13px; font-weight: 700; color: var(--sub); box-shadow: var(--shadow-chip);
  }
  .chip.active { background: var(--ink); color: #fff; }
  .catcher { position: fixed; inset: 0; z-index: 42; background: transparent; border: none; }
  .popout { position: absolute; top: calc(100% + 8px); right: 0; z-index: 43; width: 280px; }
  .ring { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; }
  .ringval { font-size: 15px; font-weight: 800; }
  .wez { padding: 8px 16px; min-width: 116px; text-align: left; }
  .wez .big { font-size: 30px; font-weight: 800; letter-spacing: -1px; }
  .wez .sub { font-size: 10px; font-weight: 600; color: var(--sub); }
  .wez:not(.win):not(.loss) { background: var(--tint-red); }
  .wez:not(.win):not(.loss) .big { color: var(--red); }
  .wez.win { background: var(--tint-green); }
  .wez.win .big.ok, .wez.win .sub { color: var(--green); }
  .wez.loss { background: var(--tint-red); }
  .wez.loss .big.bad, .wez.loss .sub { color: var(--red); }
  .pulse { animation: softpulse 1s ease-in-out infinite; }
</style>
