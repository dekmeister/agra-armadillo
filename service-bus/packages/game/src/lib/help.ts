/**
 * Help copy for the "How to play" modal — split per WP2 (PLAN_REVIEW.md) into
 * a single generic "how the game works" block shown identically on every level,
 * plus a per-mission "this mission" section keyed by `scenarioId`.
 *
 * The per-mission text is authored straight from each level's beat `summary`/
 * `concept` strings in `packages/core/src/scenarios/phaseN.ts` and the picker
 * blurbs in `phases.ts`, so Help can never describe a mechanic the level does not
 * actually run (the fidelity guard rail — see CLAUDE.md). Action wording mirrors
 * the buttons in `components/DecisionCard.svelte` / `Dock/Inspector.svelte`.
 *
 * Strings carry the same light inline markup (`<b>`/`<i>`/`<code>`) the modal
 * already used and render via `{@html}` in `Modal.svelte`. This is static,
 * developer-authored copy — no user input — so `{@html}` is safe here.
 */

/** The per-level "This mission" section. Fields are inner HTML (no wrapping tag). */
export interface MissionHelp {
  situation: string; // what's happening this level
  goal: string; // the win objective, one or two sentences
  tryThis: string[]; // the concrete actions available this level (each an <li>)
  winLose: string; // one line, may contain <br /> — Win: … / Lose: …
}

/**
 * How the game works — level-independent. Merges the old Help modal's "How it
 * flows" + "Reading the board" blocks, made generic (the WEZ-specific sentence
 * moved into Phase 6's entry). Rendered as a block of HTML.
 */
export const GENERIC_HELP = `
<p>The mission runs on a <b>1-second clock</b>, but <b>auto-pauses at each decision point</b>
  and explains what just happened. Read it, pick an action (or <b>Hold</b> to do nothing), and
  the clock resumes. Any countdown or timer only ticks while the mission is running —
  <b>reading is free</b>.</p>
<p>You can also act at any time from the <b>Inspector</b> on the right, and <b>click anything on
  the board</b> — a node, a link, or a message token — to inspect it.</p>
<p><b>Reading the board.</b> Token <b>shape marks the interface class</b> (<b>square = C2</b>,
  <b>circle = P2P</b>). A <b>grey line</b> is a <b>GOOD</b> link; <b>amber marching dashes</b> mark
  a <b>BAD</b> (bursty/lossy) link. A <b>gold seal</b> marks verified authority. Count badges on a
  node show its <b>queue depth</b>.</p>
`;

/** Per-mission Help, keyed by scenarioId ("phase1".."phase8"). */
export const MISSION_HELP: Record<string, MissionHelp> = {
  // Phase 1 — Launch. Beats: lifecycle (round-trip interaction), on-platform-free (VI is free).
  phase1: {
    situation:
      "ACP-1 requests takeoff from the <b>LRE</b>. Watch the interaction — a request plus its " +
      "required status reply — walk the DMS lifecycle <code>PENDING → EXECUTING → SENT</code>. " +
      "Meanwhile the <b>VI</b> command to Flight Autonomy loops <b>on-platform</b>, for free.",
    goal:
      "Complete the takeoff round trip. The takeoff isn't done when the request arrives — it's " +
      "done when the <b>LRE's status reply gets back</b>.",
    tryThis: [
      "Nothing to fix here — the links are clean. Just <b>watch the round trip close</b>.",
      "Notice the <b>VI self-loop</b> never crosses the air (no burst loss, no bandwidth cost) " +
        "while the C2 takeoff does — that split is why C2 can stall later and VI never will.",
    ],
    winLose:
      "Win: the LRE's status reply returns (SENT) and the round trip closes.<br />" +
      "This level can't be lost — it teaches by observation.",
  },

  // Phase 2 — Hold. Beats: link-bad (Gilbert–Elliott BAD burst), missing-ack (harmless retry).
  phase2: {
    situation:
      "ACP-1 flies a hold pattern, sending periodic status reports to the LRE. The status link " +
      "just dropped into a <b>BAD burst</b> — modelled as a two-state Gilbert–Elliott channel, so " +
      "losses come in bursts, not one-offs. A report returns <b>FAIL_MISSING_ACK</b>: it left the " +
      "queue but no delivery confirmation came back.",
    goal: "Get the required hold reports <b>confirmed</b> before the hold window closes.",
    tryThis: [
      "When a report shows <b>FAIL_MISSING_ACK</b>, <b>re-attempt it</b> — here it's harmless " +
        "(the report may already be sitting at the LRE).",
      "<b>FAIL_UNSENT</b> dispatches re-queue and retry on their own; <b>MISSING_ACK</b> ones do " +
        "not, so they're yours to resend. <i>The same state on a strike reply in Phase 6 is far " +
        "more dangerous.</i>",
    ],
    winLose:
      "Win: enough reports confirmed before the window closes.<br />" +
      "Lose: the hold window closes with too few confirmed.",
  },

  // Phase 3 — Team Formation. Beats: elect (Static vs Raft), quorum-stall (Raft needs a majority).
  phase3: {
    situation:
      "The ACPs have formed a package but have <b>no leader</b>. You must run a <b>leader " +
      "election</b>, and it isn't free: the vote traffic (<code>MA_LeaderUpdateRequestMT</code> " +
      "over <b>P2P</b>) runs over the same links the team is trying to use.",
    goal: "Elect a leader before the formation window closes.",
    tryThis: [
      "<b>Static Fitness Score</b> — the fittest node declares locally: ~n messages, no quorum, " +
        "but inflexible.",
      "<b>Raft</b> — a candidate gathers a <b>majority</b> of votes (~2n messages) and needs a " +
        "quorum: robust to a bad node, but <b>stalls</b> if the mesh can't reach a majority.",
    ],
    winLose:
      "Win: a leader resolves in time.<br />" +
      "Lose: the window closes leaderless (e.g. Raft stalls with no quorum).",
  },

  // Phase 4 — Transit. Beats: bandwidth (demand > cap), fifo-starves (re-order the queue).
  phase4: {
    situation:
      "The package transits in formation, exchanging <b>P2P formation-status heartbeats</b>. Demand " +
      "exceeds the leader→follower link's <b>bandwidth cap</b>: the heartbeat and routine C2 both " +
      "want the same capped link, and under <b>FIFO</b> the heartbeat waits behind older routine " +
      "traffic — the formation picture goes stale.",
    goal: "Keep the formation heartbeat flowing so no follower falls out of formation.",
    tryThis: [
      "<b>Re-order the queue</b> so the deadline-bearing heartbeat floats to the front: " +
        "<b>Class</b> (serve highest priority first) or <b>Deadline (EDF)</b> (serve earliest " +
        "deadline first) instead of FIFO.",
    ],
    winLose:
      "Win: the heartbeat stays fresh through transit.<br />" +
      "Lose: the heartbeat lapses and a follower falls out of formation.",
  },

  // Phase 5 — CAP. Beats: cop-fanout (one-to-many), bulk-starves (shed to protect freshness).
  phase5: {
    situation:
      "Flying Combat Air Patrol, the leader must sync the global <b>COP</b> " +
      "(<code>MA_SynchronizeGlobalCopToPeer</code>) to <b>every follower</b> — a one-to-many P2P " +
      "fan-out whose cost grows with package size, and each follower carries its <b>own</b> " +
      "freshness budget. Low-priority bulk <b>MD/MP</b> updates are hogging the fan-out links, so " +
      "COP syncs can't get on the air and a follower's picture is aging toward breach.",
    goal: "Keep <b>every</b> follower's COP above its freshness threshold.",
    tryThis: [
      "<b>Shed the low-priority bulk</b> so the COP syncs get the bandwidth. It's <b>triage, not " +
        "free</b> — the bulk MD/MP still matters; re-enable it once the picture recovers.",
      "Compliance is assessed on the <b>shared picture</b> — a single stale follower breaches it.",
    ],
    winLose:
      "Win: all followers stay fresh.<br />" +
      "Lose: a follower's COP goes stale — shared picture breached.",
  },

  // Phase 6 — Threat Engagement at CAP. Existing modal copy, verbatim (the dramatic peak).
  phase6: {
    situation:
      "ACP-1 (the team leader) has asked the QB to approve a strike. The QB <b>approved it</b> — " +
      "but the QB→ACP-1 return link has gone <b>BAD</b> (bursty/lossy), so the approval reply is " +
      "stuck in <b>MISSING_ACK</b>: sent, but never confirmed. <i>Delivery ≠ approval</i> — the " +
      "reply has to actually arrive, on time, with verified QB authority.",
    goal:
      "Get the reply delivered before the <b>WEZ (Weapon Engagement Zone) window</b> counts down " +
      "to zero, without letting COP freshness collapse.",
    tryThis: [
      "<b>Re-prioritise the link.</b> Click the amber dashed <b>QB→ACP-1</b> link, then set its " +
        "queue order to <b>Deadline</b> or <b>Class</b> so the reply jumps ahead of routine traffic.",
      "<b>Reroute.</b> Click the stalled reply token (the spinning red “?”) and send it via " +
        "a relay platform's DMS (<b>QB → ACP-2 → ACP-1</b>) — reliable, but slower.",
      "<b>Re-request</b> issues a fresh approval — but onto the same BAD link, so on its own it's " +
        "usually not enough.",
    ],
    winLose:
      "Win: reply delivered + QB authority verified before the deadline.<br />" +
      "Lose: deadline missed, or approval acted on under the wrong authority.",
  },

  // Phase 7 — RTB @ Bingo. Beats: rtb-rejected (authority is contextual), split (merge on command).
  phase7: {
    situation:
      "At Bingo Fuel the team must return to base. But the RTB was routed to the <b>QB</b> and came " +
      "back <b>REJECTED / CannotComply</b> — authority is contextual: the QB is the Target Authority " +
      "for <i>weapon employment</i>, but <b>return-to-base is the LRE's call</b>. A partition may " +
      "also orphan half the package, risking split-brain.",
    goal: "Get the RTB authorised under the right role — and keep the package whole.",
    tryThis: [
      "<b>Hand authority back QB → LRE</b> and re-issue the RTB (<i>arrival ≠ authority</i> — the " +
        "same gate as the Phase 6 strike, now inverted).",
      "If the package splits, the orphan half re-elects a local leader, then <b>merge only on " +
        "command</b> once contact is restored — A-GRA never auto-merges.",
    ],
    winLose:
      "Win: RTB authorised under the LRE and the package stays whole.<br />" +
      "Lose: RTB rejected under the wrong authority, or a split left unmerged.",
  },

  // Phase 8 — Land. Beat: debrief (campaign synthesis — landing is the LRE's call).
  phase8: {
    situation:
      "The campaign's calm bookend. <b>Landing is the LRE's call</b> — like takeoff (Phase 1) and " +
      "RTB (Phase 7), not the QB's. One clean C2 round trip over a short-range LRE link closes the " +
      "mission.",
    goal: "Complete the landing authorisation round trip under LRE authority.",
    tryThis: [
      "Nothing to fix — the link is clean and short-range again. <b>Watch the round trip close.</b>",
      "Review the debrief's tour of the topology you flew: <b>C2</b> gated by role, <b>P2P</b> for " +
        "team formation / election / COP, <b>MS/DMS</b> reroutes across the contested air, and the " +
        "on-platform <b>VI</b> lanes that never leave the platform.",
    ],
    winLose: "Win: the landing round trip completes — the campaign resolves.",
  },
};

/** The mission Help for a loaded level, falling back to Phase 6 for unknown ids. */
export function missionHelp(scenarioId: string): MissionHelp {
  // phase6 is always present in MISSION_HELP, so the fallback is total.
  return MISSION_HELP[scenarioId] ?? MISSION_HELP.phase6!;
}
