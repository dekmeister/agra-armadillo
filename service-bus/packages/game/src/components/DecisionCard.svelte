<script lang="ts">
/**
 * The decision window — a permanent card in the left column under the Objective.
 * When the core raises a beat the store auto-pauses the clock; this card shows the
 * one A-GRA lesson in short form, focuses the relevant element on the board, and
 * offers the beat's actions. Each action applies and resumes; "Hold" resumes
 * without acting (the do-nothing path). There is no scrim, so the board stays
 * fully clickable while paused — the player can inspect nodes/links/tokens at
 * their own pace. "More info" opens the full A-GRA explanation in a modal.
 */
import { game } from "../lib/store.svelte.ts";

const beat = $derived(game.gs.pendingBeat);

// The full-text "More info" modal.
let showInfo = $state(false);

// Land the player's eye (and the Inspector) on the thing the beat is about. Only
// re-fires when a new beat is raised, so the player can click elsewhere freely.
$effect(() => {
  const b = game.gs.pendingBeat;
  if (b) game.select(b.focus.kind, b.focus.id);
});

const focusLink = $derived(beat?.focus.kind === "link" ? beat.focus.id : "bad");

/** Run a corrective action, then resume the clock so its effect plays out. */
function act(fn: () => void): void {
  fn();
  game.resume();
}
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (showInfo = false)} />

{#if beat}
  <div class="card dcard" role="region" aria-label={beat.title}>
    <div class="tagrow">
      <span class="tag">DECISION · T+{beat.tick}</span>
      <span class="paused">⏸ paused</span>
    </div>
    <h2>{beat.title}</h2>
    <p class="summary">{beat.summary}</p>

    <div class="acts">
      {#if beat.actions.includes("setPolicy")}
        <button class="primary" onclick={() => act(() => game.setPolicy(focusLink, "edf"))}>
          ▸ Deadline (EDF) — float the reply to the front
        </button>
        <button class="primary" onclick={() => act(() => game.setPolicy(focusLink, "class"))}>
          ▸ Class — dispatch by priority
        </button>
      {/if}
      {#if beat.actions.includes("reroute")}
        <button class="primary" onclick={() => act(() => game.reroute())}>
          ▸ Reroute via ACP-2's DMS (QB→ACP-2→ACP-1)
        </button>
      {/if}
      {#if beat.actions.includes("rerequest")}
        <button class="warn" onclick={() => act(() => game.rerequest())}>
          ↻ Re-request approval (re-routes onto the same BAD link)
        </button>
      {/if}
      {#if beat.actions.includes("refreshCop")}
        <button class="primary" onclick={() => act(() => game.refreshCop())}>
          ⟳ Push COP refresh over P2P
        </button>
      {/if}
      {#if beat.actions.includes("retry")}
        <button class="primary" onclick={() => act(() => game.retry())}>
          ↻ Re-attempt the unconfirmed report(s)
        </button>
      {/if}
      {#if beat.actions.includes("pickElection")}
        <button class="primary" onclick={() => act(() => game.pickElection("static"))}>
          ▸ Static Fitness — cheap, the fittest declares (no quorum)
        </button>
        <button class="primary" onclick={() => act(() => game.pickElection("raft"))}>
          ▸ Raft — robust, gather a majority of votes (~2n msgs)
        </button>
      {/if}
      {#if beat.actions.includes("shedTraffic")}
        <button class="primary" onclick={() => act(() => game.shedTraffic())}>
          ▸ Shed low-priority bulk (protect the COP fan-out)
        </button>
      {/if}
      {#if beat.actions.includes("handBack")}
        <button class="primary" onclick={() => act(() => game.handBack())}>
          ▸ Hand authority back QB → LRE (re-issue RTB)
        </button>
      {/if}
      {#if beat.actions.includes("mergeTeam")}
        <button class="warn" onclick={() => act(() => game.mergeTeam())}>
          ⇔ Merge the package on command (heal the split)
        </button>
      {/if}
      <button class="info" onclick={() => (showInfo = true)}>ⓘ More info</button>
      <button class="hold" onclick={() => game.resume()}>
        {beat.actions.length ? "Hold — resume without acting ▶" : "Acknowledged — resume ▶"}
      </button>
    </div>
  </div>
{:else}
  <div class="card idle" role="region" aria-label="Decision window">
    <span class="caps">Decision window</span>
    <p>Mission running — a panel appears here whenever a decision is needed. Click any node, link or
      message to inspect it.</p>
  </div>
{/if}

{#if showInfo && beat}
  <div
    class="backdrop"
    onclick={() => (showInfo = false)}
    onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (showInfo = false)}
    role="button"
    tabindex="-1"
    aria-label="Close"
  ></div>
  <div class="modal card" role="dialog" aria-modal="true" aria-label={beat.title}>
    <div class="mhead">
      <h2>{beat.title}</h2>
      <button class="x" onclick={() => (showInfo = false)} aria-label="Close">✕</button>
    </div>
    <p class="concept">{beat.concept}</p>
  </div>
{/if}

<style>
  .dcard { padding: 16px 16px 14px; border-top: 4px solid var(--amber); }
  .tagrow { display: flex; align-items: center; justify-content: space-between; }
  .tag {
    font-size: 10px; font-weight: 800; letter-spacing: 1px; color: var(--amber);
    background: var(--tint-amber); padding: 3px 9px; border-radius: 999px;
  }
  .paused { font-size: 11px; font-weight: 700; color: var(--sub); }
  h2 { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; margin: 10px 0 6px; }
  .summary { font-size: 13px; line-height: 1.5; color: #34383e; margin: 0 0 14px; }
  .acts { display: flex; flex-direction: column; gap: 8px; }
  .acts button {
    border-radius: 10px; padding: 11px 14px; font-size: 13px; font-weight: 700; text-align: left;
  }
  .primary { background: var(--ink); color: #fff; border: none; }
  .warn { background: var(--tint-amber); color: #8a5a00; border: 1px solid var(--bad); }
  .info { background: #fff; color: var(--sub); border: 1px solid var(--hair); }
  .hold { background: #fff; color: var(--ink); border: 1px solid var(--hair); margin-top: 2px; }

  /* Idle placeholder — flat and muted, no amber accent. */
  .idle { padding: 14px 16px; }
  .idle .caps {
    text-transform: uppercase; letter-spacing: 1.2px; font-size: 10px; font-weight: 700;
    color: var(--sub);
  }
  .idle p { font-size: 12px; line-height: 1.5; color: var(--sub); margin: 8px 0 0; }

  /* "More info" modal — mirrors the chrome in Modal.svelte / Debrief.svelte. */
  .backdrop { position: fixed; inset: 0; background: rgba(27, 31, 36, 0.32); z-index: 44; border: none; }
  .modal {
    position: fixed; z-index: 45; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(520px, 92vw); max-height: 84vh; overflow-y: auto; padding: 0;
    border-top: 4px solid var(--amber);
  }
  .mhead {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px 12px; border-bottom: 1px solid var(--hair);
  }
  .mhead h2 { font-size: 17px; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
  .x { border: none; background: var(--seg-track); width: 30px; height: 30px; border-radius: 8px; font-weight: 700; color: var(--sub); }
  .concept { font-size: 13.5px; line-height: 1.55; color: #34383e; margin: 0; padding: 16px 22px 22px; }
</style>
