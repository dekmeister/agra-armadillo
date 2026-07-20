<script lang="ts">
/**
 * Causal win/loss debrief. Turns the bare outcome into a "why" the player can
 * learn from: the cause, the decision points they hit (each with its A-GRA
 * takeaway), the moves they made, and — because the tutorial seed is clamped —
 * the deterministic counterfactual when they lose.
 */
import type { ElectionMethod } from "@service-bus/core";
import {
  electionCounterfactual,
  getScenario,
  STRATEGY_WIN_RATES,
  SWEEP_SEEDS,
  taughtPathOutcome,
} from "@service-bus/core";
import { phaseByScenario } from "../lib/phases.ts";
import { game } from "../lib/store.svelte.ts";
import { SYNTHESIS, SYNTHESIS_CLOSER } from "../lib/synthesis.ts";

// The picker exit is App's to open (it owns modal state); the debrief just asks for it.
const { onMissions }: { onMissions: () => void } = $props();

const gs = $derived(game.gs);
const won = $derived(gs.outcome === "win");

// Campaign progression: on a win, offer the next OV-1 phase (Phase 8 has none → the
// campaign-complete state; the full synthesis screen is WP6, this is its minimal stub).
const nextId = $derived(game.nextScenarioId);
const nextName = $derived(nextId ? (phaseByScenario(nextId)?.name ?? null) : null);
const campaignComplete = $derived(won && nextId === null);

/**
 * Decision points, resolved through the level's own ScenarioDef (WP6.4).
 *
 * This used to be two hand-maintained `Partial<Record<BeatId, string>>` maps here in the
 * view: a beat with no entry rendered a literal "undefined — undefined", and nothing
 * stopped a lesson restating its own title — which Phase 2's did, printing
 * "FAIL_MISSING_ACK — FAIL_MISSING_ACK — …". Both are now unrepresentable: `takeaway` is a
 * required field on `Beat`, and `seenBeats` can only ever hold this level's own beat ids.
 */
const beats = $derived.by(() => {
  const defs = getScenario(gs.scenarioId).beats;
  return gs.seenBeats.flatMap((id) => {
    const b = defs[id];
    return b ? [{ id, title: b.title, takeaway: b.takeaway }] : [];
  });
});

const cause = $derived(
  won ? `Objective complete at T+${gs.tick}.` : (gs.failReason ?? "Mission failed."),
);

/**
 * The player's moves, straight from the core (WP6.3). This used to regex the event log,
 * which listed Phase 6's *automatic* "Re-attempting." line as a player action — so a run
 * where the player did nothing at all still showed a move they never made — while missing
 * `pickElection`, `resumeTraffic` and `requestVia`, none of which log matching prose.
 */
const moves = $derived(gs.playerMoves);

/**
 * The road not taken, computed rather than asserted (WP6.2).
 *
 * Phase 6 used to print a fixed sentence on every loss claiming rerouting would have got
 * the reply through — without checking whether that held for the run being debriefed. Now
 * every level with a taught path replays it on *this run's* seed and reports what actually
 * happens; if the taught path does not win, we say nothing rather than promise a fix that
 * would not have worked.
 */
const counterfactual = $derived.by(() => {
  if (won) return null;
  const alt = taughtPathOutcome(gs.scenarioId, gs.config.seed);
  if (!alt?.won || !alt.moves.length) return null;
  // Collapse consecutive repeats: L2's winning line is the same re-attempt four times over,
  // and spelling it out four times reads as noise rather than as a lesson.
  const runs: { label: string; n: number }[] = [];
  for (const m of alt.moves) {
    const last = runs[runs.length - 1];
    if (last?.label === m.label) last.n += 1;
    else runs.push({ label: m.label, n: 1 });
  }
  // Lower-case only the leading character — the labels carry real acronyms (DMS, COP, LRE)
  // that a blanket toLowerCase would quietly destroy.
  const what = runs
    .map((r) => `${r.label.charAt(0).toLowerCase()}${r.label.slice(1)}${r.n > 1 ? ` ×${r.n}` : ""}`)
    .join(", then ");
  return `On this seed the winning line resolves at T+${alt.tick} — ${what}.`;
});

/**
 * L3's road not taken (WP5.4). The player picks Static or Raft and never sees the other,
 * so the level's actual subject — the cost/robustness trade — is one they only experience
 * half of. Shown on WIN as well as loss: it is a comparison, not a consolation.
 *
 * Computed by replaying the other branch on this level's own seed, so the numbers are
 * exact and cannot go stale if the scenario is retuned.
 */
/**
 * The sweep's verdict on the level the player just fought (WP6.5).
 *
 * The headless harness has always been able to prove the game's central claim — routing
 * and queue discipline get the reply through; retrying onto the same degraded link is worse
 * than doing nothing — but the answer only ever reached a terminal. Phase 6 is where the
 * player has just lived the choice, so it is the one place the numbers land.
 *
 * Shown on wins too: a player who rerouted deserves to see how much that was worth, and a
 * player who scraped a win under FIFO deserves to know it was luck.
 */
const showSweep = $derived(gs.scenarioId === "phase6");
/** Which row to mark as the path this run actually took. */
const tookStrategy = $derived.by(() => {
  const types = new Set(gs.playerMoves.map((m) => m.action.type));
  if (types.has("reroute")) return "reroute";
  if (types.has("rerequest") || types.has("requestVia")) return "rerequest";
  if (gs.playerMoves.some((m) => m.action.type === "setPolicy")) return "class";
  return "none";
});

const electionAlt = $derived.by(() => {
  const taken = gs.election?.method as ElectionMethod | undefined;
  if (gs.scenarioId !== "phase3" || !taken) return null;
  // This run's seed, not the scenario's default — the store can load a level with an
  // override, and comparing against a seed the player never played is worse than silence.
  const alt = electionCounterfactual(gs.scenarioId, gs.config.seed, taken);
  if (!alt) return null;
  const name = alt.method === "raft" ? "Raft" : "Static Fitness Score";
  return alt.stalled
    ? `On this seed, ${name} would have stalled — no quorum, so the package stays leaderless.`
    : `On this seed, ${name} would have cost ${alt.messages} messages and elected at T+${alt.electedTick}.`;
});
</script>

<div class="backdrop" role="presentation"></div>
<div class="modal card" class:won class:complete-view={campaignComplete} role="dialog" aria-modal="true" aria-label="Debrief">
  <div class="head">
    <span class="verdict" class:won>{won ? "✓ MISSION COMPLETE" : "✕ MISSION FAILED"}</span>
  </div>
  <p class="cause">{cause}</p>

  {#if beats.length}
    <div class="caps">Decision points</div>
    <ul class="beats">
      {#each beats as b (b.id)}
        <li><b>{b.title}</b> — {b.takeaway}</li>
      {/each}
    </ul>
  {/if}

  {#if moves.length}
    <div class="caps">Your moves</div>
    <ul class="moves">
      {#each moves as m, i (i)}<li>T+{m.tick} · {m.label}</li>{/each}
    </ul>
  {/if}

  {#if counterfactual}
    <p class="counter">↳ {counterfactual}</p>
  {/if}

  {#if electionAlt}
    <div class="caps">The other method</div>
    <p class="counter">↳ {electionAlt}</p>
  {/if}

  {#if showSweep}
    <div class="caps">Across {SWEEP_SEEDS} seeds</div>
    <ul class="sweep">
      {#each STRATEGY_WIN_RATES as row (row.strategy)}
        <li class:took={row.strategy === tookStrategy}>
          <span class="slabel">{row.label}</span>
          <span class="bar"><i style="width: {(row.rate * 100).toFixed(0)}%"></i></span>
          <span class="rate">{(row.rate * 100).toFixed(0)}%</span>
        </li>
      {/each}
    </ul>
    <p class="sweepnote">
      Win rate in this simulation's link model, recovering at T+4 — not an A-GRA figure.
      Reproduce with <code>npm run sweep -- scenarios/phase6.json --compare --seeds {SWEEP_SEEDS}</code>.
    </p>
  {/if}

  {#if campaignComplete}
    <!-- WP5.5: the synthesis belongs here, not in a Phase 8 beat that fired at T+1 and
         narrated the landing before it happened. This is the only moment the player has
         actually flown all eight. -->
    <p class="complete">✓ Campaign complete — all eight OV-1 phases flown.</p>
    <div class="caps">What the campaign taught</div>
    <table class="synth">
      <thead>
        <tr><th>Phase</th><th>Interfaces</th><th>Authority</th></tr>
      </thead>
      <tbody>
        {#each SYNTHESIS as row (row.phase)}
          <tr>
            <td class="ph"><b>{row.phase}</b> {row.name}</td>
            <td>{row.interfaces}</td>
            <td>{row.authority}</td>
          </tr>
          <tr class="lesson"><td colspan="3">{row.lesson}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="closer">{SYNTHESIS_CLOSER}</p>
  {/if}

  <div class="actions">
    {#if won && nextName}
      <!-- Win (Phases 1–7): straight into the next mission is the primary path. -->
      <button class="btn primary" onclick={() => game.advance()}>Next mission ▸ {nextName}</button>
      <button class="btn ghost" onclick={() => game.replay()}>↻ Replay</button>
    {:else}
      <!-- Loss, or the Phase 8 campaign-complete win: replay is primary; the picker is the
           way out to another phase. -->
      <button class="btn primary" onclick={() => game.replay()}>↻ Replay</button>
      <button class="btn ghost" onclick={onMissions}>Missions ▸</button>
    {/if}
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(27, 31, 36, 0.32); z-index: 50; }
  .modal {
    position: fixed; z-index: 51; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(520px, 92vw); max-height: 86vh; overflow-y: auto; padding: 22px 24px;
    border-top: 5px solid var(--red);
  }
  .modal.won { border-top-color: var(--green); }
  /* The synthesis table needs more room than a normal debrief; only the final win shows it. */
  .modal.complete-view { width: min(760px, 94vw); }
  .synth { width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0 4px; }
  .synth th {
    text-align: left; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sub); font-weight: 700; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--hair);
  }
  .synth td { padding: 6px 8px 2px 0; vertical-align: top; color: #34383e; }
  .synth .ph { white-space: nowrap; }
  .synth tr.lesson td {
    padding: 0 0 8px; color: var(--sub); font-style: italic; border-bottom: 1px solid var(--hair);
  }
  .closer { font-size: 13px; line-height: 1.55; color: #34383e; margin: 14px 0 4px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; }
  .verdict { font-size: 18px; font-weight: 800; letter-spacing: -0.3px; color: var(--red); }
  .verdict.won { color: var(--green); }
  .cause { font-size: 14px; line-height: 1.5; color: #34383e; margin: 10px 0 16px; }
  .caps {
    text-transform: uppercase; letter-spacing: 1.2px; font-size: 10px; font-weight: 700;
    color: var(--sub); margin: 14px 0 6px;
  }
  .beats, .moves { margin: 0; padding-left: 18px; }
  .beats li { font-size: 13px; line-height: 1.5; margin: 4px 0; }
  .moves li { font-size: 12px; line-height: 1.45; color: var(--sub); margin: 3px 0; }
  .counter {
    font-size: 13px; font-weight: 700; color: #8a5a00; background: var(--tint-amber);
    border-radius: 10px; padding: 10px 12px; margin: 14px 0 0; line-height: 1.45;
  }
  .complete {
    font-size: 13px; font-weight: 700; color: var(--green); background: var(--tint-green);
    border-radius: 10px; padding: 10px 12px; margin: 14px 0 0; line-height: 1.45;
  }
  /* Strategy strip (WP6.5). Neutral ink bars — amber is reserved for degradation
     (see lib/palette.ts + palette.test.ts), and these are outcomes, not warnings. */
  .sweep { list-style: none; margin: 0; padding: 0; }
  .sweep li {
    display: grid; grid-template-columns: 1fr 84px 34px; align-items: center;
    gap: 8px; font-size: 11.5px; color: var(--sub); padding: 2px 0;
  }
  .sweep li.took { color: var(--ink); font-weight: 700; }
  .sweep .bar { display: block; height: 6px; border-radius: 3px; background: var(--seg-track); }
  .sweep .bar i { display: block; height: 100%; border-radius: 3px; background: var(--sub); }
  .sweep li.took .bar i { background: var(--ink); }
  .sweep .rate { text-align: right; font-variant-numeric: tabular-nums; }
  .sweepnote { font-size: 10.5px; line-height: 1.45; color: var(--sub); margin: 8px 0 0; }
  .sweepnote code { font-size: 10px; }
  .actions { display: flex; gap: 10px; margin-top: 18px; }
  .btn {
    border: none; border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 800;
    cursor: pointer;
  }
  .btn.primary { flex: 1; background: var(--ink); color: #fff; }
  .btn.ghost {
    flex: none; background: var(--seg-track); color: var(--sub); padding: 12px 16px;
    white-space: nowrap;
  }
</style>
