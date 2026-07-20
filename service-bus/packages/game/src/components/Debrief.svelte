<script lang="ts">
/**
 * Causal win/loss debrief. Turns the bare outcome into a "why" the player can
 * learn from: the cause, the decision points they hit (each with its A-GRA
 * takeaway), the moves they made, and — because the tutorial seed is clamped —
 * the deterministic counterfactual when they lose.
 */
import type { BeatId, ElectionMethod } from "@service-bus/core";
import { electionCounterfactual, getScenario } from "@service-bus/core";
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

/** One-line takeaway per decision point (the beat's lesson, distilled). */
const LESSONS: Partial<Record<BeatId, string>> = {
  "link-degraded": "C2 crosses the contested air, so it suffers Gilbert–Elliott burst loss.",
  "queue-starved": "Queue discipline decides which message gets the link's scarce GOOD windows.",
  "missing-ack":
    "Arrival ≠ approval — reroute around a BAD hop, and never mistake a reachable node for an authorised one.",
  "cop-warning": "Don't starve the P2P COP picture while you fight the C2 reply.",
  lifecycle: "An interaction is a round trip: request + its required status reply.",
  "on-platform-free": "VI is on-platform — free, never crosses the contested air.",
  "burst-loss": "Tactical links fail in BURSTS (Gilbert–Elliott), not independent coin flips.",
  "missing-ack-intro": "FAIL_MISSING_ACK — sent but unconfirmed; retry it (delivery ≠ confirmation).",
  "election-cost": "Election method trades cost vs robustness (Static ~n, Raft ~2n + quorum).",
  quorum: "Raft needs a majority and STALLS without one; Static declares locally.",
  "bandwidth-cap": "Bandwidth is finite — excess demand queues and waits.",
  "queue-discipline": "Class/EDF float the critical flow ahead of routine traffic; FIFO starves it.",
  "cop-fanout": "COP is one-to-many; freshness is a per-follower budget.",
  "cop-starvation":
    "Shed low-priority bulk to protect the COP fan-out — triage, and it costs track completeness.",
  "bulk-resume": "Restore the shed feed within budget once the pressure lifts; a shed never resumed is capability given away.",
  "authority-handback": "Authority is contextual — RTB is the LRE's, not the QB's.",
  "split-brain": "Orphan re-elects locally; halves merge ONLY on command (never auto).",
  "campaign-debrief":
    "The same C2 command type means different things at different destinations; landing is the LRE's.",
};
const beatTitle: Partial<Record<BeatId, string>> = {
  "link-degraded": "Return link degraded",
  "queue-starved": "Reply starved under FIFO",
  "missing-ack": "FAIL_MISSING_ACK",
  "cop-warning": "COP nearing breach",
  lifecycle: "Round-trip lifecycle",
  "on-platform-free": "VI is free",
  "burst-loss": "Burst loss",
  "missing-ack-intro": "FAIL_MISSING_ACK",
  "election-cost": "Election cost",
  quorum: "Quorum stall",
  "bandwidth-cap": "Bandwidth cap",
  "queue-discipline": "Queue discipline",
  "cop-fanout": "COP fan-out",
  "cop-starvation": "COP starvation",
  "bulk-resume": "Sensor feed restored",
  "authority-handback": "Authority hand-back",
  "split-brain": "Split-brain",
  "campaign-debrief": "Landing authority",
};

const cause = $derived(
  won ? `Objective complete at T+${gs.tick}.` : (gs.failReason ?? "Mission failed."),
);

// Reconstruct the player's moves from the event log (the core doesn't track them per-beat).
const moves = $derived(
  gs.log
    .filter((l) =>
      /queue policy ->|rerouted|re-requested|COP refreshed|Re-attempting|declared leader|requesting votes|Shed |handed back|merged on command/.test(
        l.text,
      ),
    )
    .map((l) => `T+${l.tick} · ${l.text}`),
);

// Deterministic counterfactual on Phase 6's clamped tutorial seed only.
const tookReroute = $derived(gs.log.some((l) => /rerouted/.test(l.text)));
const counterfactual = $derived(
  gs.scenarioId === "phase6" && !won && !tookReroute
    ? "On this seed, rerouting at the MISSING_ACK point (QB→ACP-2→ACP-1) delivers the reply in time."
    : null,
);

/**
 * L3's road not taken (WP5.4). The player picks Static or Raft and never sees the other,
 * so the level's actual subject — the cost/robustness trade — is one they only experience
 * half of. Shown on WIN as well as loss: it is a comparison, not a consolation.
 *
 * Computed by replaying the other branch on this level's own seed, so the numbers are
 * exact and cannot go stale if the scenario is retuned.
 */
const electionAlt = $derived.by(() => {
  const taken = gs.election?.method as ElectionMethod | undefined;
  if (gs.scenarioId !== "phase3" || !taken) return null;
  const seed = getScenario(gs.scenarioId).tutorialSeed;
  const alt = electionCounterfactual(gs.scenarioId, seed, taken);
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

  {#if gs.seenBeats.length}
    <div class="caps">Decision points</div>
    <ul class="beats">
      {#each gs.seenBeats as id (id)}
        <li><b>{beatTitle[id]}</b> — {LESSONS[id]}</li>
      {/each}
    </ul>
  {/if}

  {#if moves.length}
    <div class="caps">Your moves</div>
    <ul class="moves">
      {#each moves as m (m)}<li>{m}</li>{/each}
    </ul>
  {/if}

  {#if counterfactual}
    <p class="counter">↳ {counterfactual}</p>
  {/if}

  {#if electionAlt}
    <div class="caps">The other method</div>
    <p class="counter">↳ {electionAlt}</p>
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
