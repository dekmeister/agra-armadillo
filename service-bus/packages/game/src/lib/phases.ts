/**
 * The eight OV-1 mission phases — the campaign spine and the curriculum order.
 * Single source of truth for the Levels picker (the OV-1 hotspot map + its detail
 * panel), mirroring how `layout.ts` centralizes board geometry.
 *
 * Names, ordering, interface mixes and "teaches" notes track `docs/02-mission-phases.md`
 * exactly — the picker must never teach a false phase/interface mix. All eight phases are
 * now implemented (core sim), so each is `playable` and maps to a `scenarioId`.
 *
 * `hotspot`/`marker` are in OV-1 image coordinates (viewBox `0 0 1052 591`), keyed to
 * where each phase is labeled in `assets/ov1.jpg`. Phases 1 (Launch) and 8 (Land) share
 * the launch/recovery area of the image — faithful, both happen there.
 */
export interface Phase {
  id: number; // 1..8, OV-1 phase number
  name: string;
  interfaces: string; // ★-dominant L1 interface mix (from docs/02)
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
    interfaces: "★C2 (LRE) · VI · MS-PNT",
    teaches: "LRE role authority is narrow — and its link is short-range and clean.",
    blurb: "ACPs take off under LRE oversight; VI flies Waypoint/HSA and PNT initialises.",
    playable: true,
    scenarioId: "phase1",
    hotspot: [60, 355, 175, 105],
    marker: [105, 393],
  },
  {
    id: 2,
    name: "Hold",
    interfaces: "VI★ · MS · light C2",
    teaches: "VI is free; OTA costs. The idle baseline before the team forms.",
    blurb: "Fly a hold pattern and await QB arrival, sending periodic status to LRE.",
    playable: true,
    scenarioId: "phase2",
    hotspot: [175, 262, 150, 58],
    marker: [212, 290],
  },
  {
    id: 3,
    name: "Team formation",
    interfaces: "★P2P · C2",
    teaches: "Leader election has a real message cost — the first true P2P load.",
    blurb: "Join a package and elect a leader (MA_PackageManagementCommandMT).",
    playable: true,
    scenarioId: "phase3",
    hotspot: [615, 250, 250, 85],
    marker: [660, 288],
  },
  {
    id: 4,
    name: "Transit",
    interfaces: "★P2P · VI · C2",
    teaches: "Sustained P2P heartbeat plus formation keeping to the Mission Area.",
    blurb: "Transit in formation; provide/receive formation status and seed the COP.",
    playable: true,
    scenarioId: "phase4",
    hotspot: [575, 193, 150, 52],
    marker: [610, 219],
  },
  {
    id: 5,
    name: "CAP",
    interfaces: "★P2P (COP) · MS★ · C2",
    teaches: "COP fan-out bandwidth — the throughput core of the network.",
    blurb: "Allocate zone coverage and fly Combat Air Patrol; sync the global COP to peers.",
    playable: true,
    scenarioId: "phase5",
    hotspot: [585, 145, 300, 42],
    marker: [625, 166],
  },
  {
    id: 6,
    name: "Threat Engagement at CAP",
    interfaces: "★C2 (gated) · ★P2P · one contingency",
    teaches: "A gated round-trip under time pressure — the dramatic peak.",
    blurb:
      "Push a deadline-critical strike-approval reply through a degraded return link before the WEZ window closes.",
    playable: true,
    scenarioId: "phase6",
    hotspot: [560, 25, 470, 95],
    marker: [600, 58],
  },
  {
    id: 7,
    name: "RTB @ Bingo",
    interfaces: "★C2 (LRE/alt) · VI★ · P2P",
    teaches: "Authority hands back C2→LRE as the thinning team returns to base.",
    blurb: "At Bingo Fuel, request RTB to the primary/alternate site with sense-and-avoid.",
    playable: true,
    scenarioId: "phase7",
    hotspot: [430, 235, 225, 85],
    marker: [470, 272],
  },
  {
    id: 8,
    name: "Land",
    interfaces: "★C2 (LRE) · VI",
    teaches: "Back to a clean short link; the mission resolves.",
    blurb: "Land at the designated airfield under LRE authority; VI flies the final approach.",
    playable: true,
    scenarioId: "phase8",
    hotspot: [245, 378, 150, 55],
    marker: [285, 405],
  },
];
