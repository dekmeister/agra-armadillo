<script lang="ts">
/**
 * Causal win/loss debrief. Turns the bare outcome into a "why" the player can
 * learn from: the cause, the decision points they hit (each with its A-GRA
 * takeaway), the moves they made, and — because the tutorial seed is clamped —
 * the deterministic counterfactual when they lose.
 */
import type { BeatId } from "@service-bus/core";
import { game } from "../lib/store.svelte.ts";

const gs = $derived(game.gs);
const won = $derived(gs.outcome === "win");

/** One-line takeaway per decision point (the beat's lesson, distilled). */
const LESSONS: Partial<Record<BeatId, string>> = {
  "link-degraded": "C2 crosses the contested air, so it suffers Gilbert–Elliott burst loss.",
  "queue-starved": "Queue discipline decides which message gets the link's scarce GOOD windows.",
  "missing-ack": "Arrival ≠ approval — rerouting around a BAD hop beats blindly re-requesting.",
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
  "cop-starvation": "Shed low-priority bulk to protect the COP fan-out.",
  "authority-handback": "Authority is contextual — RTB is the LRE's, not the QB's.",
  "split-brain": "Orphan re-elects locally; halves merge ONLY on command (never auto).",
  "campaign-debrief": "Authority is contextual across the whole campaign; landing is the LRE's.",
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
  "authority-handback": "Authority hand-back",
  "split-brain": "Split-brain",
  "campaign-debrief": "Campaign debrief",
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
</script>

<div class="backdrop" role="presentation"></div>
<div class="modal card" class:won role="dialog" aria-modal="true" aria-label="Debrief">
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

  <button class="replay" onclick={() => game.replay()}>↻ Replay scenario</button>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(27, 31, 36, 0.32); z-index: 50; }
  .modal {
    position: fixed; z-index: 51; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(520px, 92vw); max-height: 86vh; overflow-y: auto; padding: 22px 24px;
    border-top: 5px solid var(--red);
  }
  .modal.won { border-top-color: var(--green); }
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
  .replay {
    margin-top: 18px; width: 100%; border: none; background: var(--ink); color: #fff;
    border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 800;
  }
</style>
