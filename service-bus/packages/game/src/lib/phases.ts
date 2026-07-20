/**
 * The eight OV-1 mission phases — the campaign spine and the curriculum order.
 * Single source of truth for the Levels picker (the OV-1 hotspot map + its detail
 * panel), mirroring how `layout.ts` centralizes board geometry.
 *
 * Names, ordering and "teaches" notes track `docs/02-mission-phases.md` exactly — the
 * picker must never teach a false phase/interface mix. All eight phases are now
 * implemented (core sim), so each is `playable` and maps to a `scenarioId`.
 *
 * **On `classes` vs `interfaces` (WP5.6).** `docs/02` records the interface mix of the
 * *real* OV-1 phase; this picker sits next to a Play button, so it must describe the
 * *level*. Those had drifted apart — L1 advertised MS-PNT with no MS traffic, L8
 * advertised VI with no VI link. `classes` is now the machine-checkable truth (the exact
 * set of InterfaceClasses the scenario spawns) and `interfaces` is the prose rendered to
 * the player. `test/picker-honesty.test.ts` plays every level and fails if either drifts
 * from the other or from the sim. Fix the traffic or fix the claim — never just the prose.
 *
 * `hotspot`/`marker` are in OV-1 view coordinates (viewBox `0 0 1052 591`), keyed to
 * where each phase sits in `OV1Scene.svelte` (spaced so each region is distinctly
 * clickable). Phases 1 (Launch) and 8 (Land) share the launch/recovery area — faithful,
 * both happen there.
 */
import type { InterfaceClass } from "@service-bus/core";

export interface Phase {
  id: number; // 1..8, OV-1 phase number
  name: string;
  /** Exactly the InterfaceClasses this level's scenario spawns. Test-pinned against the sim. */
  classes: InterfaceClass[];
  interfaces: string; // prose rendering of `classes` (★ = dominant), shown in the picker
  teaches: string; // the per-phase "Teaches:" note
  blurb: string; // one-line briefing for the detail panel
  playable: boolean; // whether the level can be loaded
  scenarioId: string; // the core ScenarioDef id this phase loads
  hotspot: [number, number, number, number]; // [x, y, w, h] clickable region in image coords
  marker: [number, number]; // [x, y] numbered-chip anchor
}

export const PHASES: Phase[] = [
  {
    id: 1,
    name: "Launch",
    classes: ["C2", "VI", "MS"],
    interfaces: "★C2 (LRE) · VI · MS-PNT",
    teaches: "LRE role authority is narrow — and its link is short-range and clean.",
    blurb:
      "ACPs take off under LRE (Launch and Recovery Element) oversight; VI flies Waypoint/HSA and PNT initialises.",
    playable: true,
    scenarioId: "phase1",
    hotspot: [72, 398, 180, 80],
    marker: [150, 432],
  },
  {
    id: 2,
    name: "Hold",
    classes: ["C2", "VI"],
    interfaces: "VI★ · light C2",
    teaches: "VI is free; OTA costs. The idle baseline before the team forms.",
    blurb:
      "Fly a hold pattern and await QB (Quarterback) arrival, sending periodic status to the LRE.",
    playable: true,
    scenarioId: "phase2",
    hotspot: [150, 258, 168, 60],
    marker: [232, 288],
  },
  {
    id: 3,
    name: "Team formation",
    classes: ["P2P"],
    interfaces: "★P2P (peer join + election)",
    teaches: "Leader election has a real message cost — the first true P2P load.",
    blurb: "Elect a package leader over P2P (MA_LeaderUpdateRequestMT).",
    playable: true,
    scenarioId: "phase3",
    hotspot: [618, 270, 230, 78],
    marker: [735, 305],
  },
  {
    id: 4,
    name: "Transit",
    classes: ["P2P", "MP"],
    interfaces: "★P2P (formation) · MP (plan update)",
    teaches: "Queue discipline decides who gets the air when a capped link is contended.",
    blurb:
      "Transit as a three-ship formation while an MP (Mission Planning) update re-tasks ACP-2 over the same capped link.",
    playable: true,
    scenarioId: "phase4",
    hotspot: [460, 222, 175, 66],
    marker: [545, 250],
  },
  {
    id: 5,
    name: "CAP",
    classes: ["P2P", "MD"],
    interfaces: "★P2P (COP) · MD (sensor bulk)",
    teaches: "COP fan-out bandwidth — and that shedding to protect it costs you something.",
    blurb:
      "Fly Combat Air Patrol and sync the global COP to three peers while MD (Mission Data) sensor bulk competes for the same air.",
    playable: true,
    scenarioId: "phase5",
    hotspot: [648, 120, 240, 58],
    marker: [762, 150],
  },
  {
    id: 6,
    name: "Threat Engagement at CAP",
    classes: ["C2", "P2P"],
    interfaces: "★C2 (gated) · ★P2P · one contingency",
    teaches: "A gated round-trip under time pressure — the dramatic peak.",
    blurb:
      "Push a deadline-critical strike-approval reply through a degraded return link before the WEZ (Weapon Engagement Zone) window closes.",
    playable: true,
    scenarioId: "phase6",
    hotspot: [560, 26, 430, 80],
    marker: [700, 60],
  },
  {
    id: 7,
    name: "RTB @ Bingo",
    classes: ["C2", "P2P"],
    interfaces: "★C2 (LRE/alt) · P2P",
    teaches: "Authority hands back C2→LRE as the thinning team returns to base.",
    blurb: "At Bingo Fuel, request RTB to the primary/alternate site with sense-and-avoid.",
    playable: true,
    scenarioId: "phase7",
    hotspot: [300, 302, 220, 78],
    marker: [405, 335],
  },
  {
    id: 8,
    name: "Land",
    classes: ["C2", "VI"],
    interfaces: "★C2 (LRE) · VI",
    teaches: "Back to a clean short link; the mission resolves.",
    blurb: "Land at the designated airfield under LRE authority; VI flies the final approach.",
    playable: true,
    scenarioId: "phase8",
    hotspot: [252, 418, 168, 74],
    marker: [325, 455],
  },
];

/** The phase whose scenarioId matches (the campaign spine is keyed on scenarioId). */
export function phaseByScenario(scenarioId: string): Phase | undefined {
  return PHASES.find((p) => p.scenarioId === scenarioId);
}

/**
 * The next campaign phase's scenarioId, or `null` at the end (Phase 8) — the campaign is
 * a linear OV-1 spine, so "next" is simply the following phase number. Drives the debrief's
 * "Next mission ▸" button; `null` lands on the campaign-complete state instead.
 */
export function nextScenarioId(scenarioId: string): string | null {
  const cur = phaseByScenario(scenarioId);
  if (!cur) return null;
  return PHASES.find((p) => p.id === cur.id + 1)?.scenarioId ?? null;
}
