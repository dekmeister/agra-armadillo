// Static world/level roster for the Level Select screen (titles from docs/03). Levels with
// `playable: true` are wired to the @brain-swap/levels registry (see LEVELS / levelById there);
// the rest are locked placeholders. Adding a level is DATA, not code: author the level JSON +
// reference brain, register it in LEVELS, then flip `playable` here. See CLAUDE.md "Adding a level".
export interface LevelEntry {
  id: string;
  name: string;
  playable?: boolean;
  capstone?: boolean;
  /** A guided watch-only demo level (drives a coachmark tour; see TutorialCoach). */
  tutorial?: boolean;
}
export interface WorldEntry {
  no: string;
  name: string;
  levels: LevelEntry[];
}

export const WORLDS: WorldEntry[] = [
  {
    no: "T",
    name: "Tutorial",
    levels: [{ id: "0.0", name: "First Flight", playable: true, tutorial: true }],
  },
  {
    no: "W1",
    name: "HSA / CSA",
    levels: [
      { id: "1.1", name: "Handshake", playable: true },
      { id: "1.2", name: "First Valid HSA Command", playable: true },
      { id: "1.3", name: "Envelope", playable: true },
      { id: "1.4", name: "Racetrack by Hand", playable: true },
      { id: "1.5", name: "Winds Aloft" },
      { id: "1.6", name: "Bingo", playable: true },
      { id: "1.7", name: "Counter-Offer" },
    ],
  },
  {
    // Merged W2 (Waypoint Following) + old W3 (Curve Following) — the route upload
    // liturgy, geofence avoidance, retask, and curve following in ~5 levels (docs/03).
    no: "W2",
    name: "Navigation",
    levels: [
      { id: "2.1", name: "Upload" },
      { id: "2.2", name: "Avoid", playable: true },
      { id: "2.3", name: "Retask" },
      { id: "2.4", name: "First Curve" },
      { id: "2.5", name: "Canyon" },
    ],
  },
  {
    // New World 3: the Mission Systems interface (sensors, weapons, status, geometry)
    // running in parallel with FA. 3.1 is built; the rest are the deferred roster (PLAN_MS.md).
    no: "W3",
    name: "Mission Systems",
    levels: [
      { id: "3.1", name: "Meet MS", playable: true },
      { id: "3.2", name: "Eyes Open" },
      { id: "3.3", name: "Clear to Engage" },
      { id: "3.4", name: "In the Zone" },
    ],
  },
  {
    no: "W4",
    name: "Brain Swap",
    levels: [
      { id: "4.2", name: "The Flinch", playable: true },
      { id: "4.3", name: "Degraded", playable: true },
      { id: "4.4", name: "Heartbeat Discipline" },
      { id: "4.5", name: "Type Certificate", playable: true, capstone: true },
    ],
  },
];

/** True if the level id is a guided watch-only tutorial demo (see TutorialCoach). */
export function isTutorialLevel(id: string): boolean {
  return WORLDS.some((w) => w.levels.some((l) => l.id === id && l.tutorial));
}
