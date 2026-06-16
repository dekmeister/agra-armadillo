// Static world/level roster for the Level Select screen (titles from docs/03). Levels with
// `playable: true` are wired to the @brain-swap/levels registry (see LEVELS / levelById there);
// the rest are locked placeholders. Adding a level is DATA, not code: author the level JSON +
// reference brain, register it in LEVELS, then flip `playable` here. See CLAUDE.md "Adding a level".
export interface LevelEntry {
  id: string;
  name: string;
  playable?: boolean;
  capstone?: boolean;
}
export interface WorldEntry {
  no: string;
  name: string;
  levels: LevelEntry[];
}

export const WORLDS: WorldEntry[] = [
  {
    no: "W0",
    name: "Listen Before You Speak",
    levels: [
      { id: "0.1", name: "First Contact" },
      { id: "0.2", name: "Spec Sheet" },
    ],
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
    no: "W2",
    name: "Waypoint Following",
    levels: [
      { id: "2.1", name: "The Upload Liturgy" },
      { id: "2.2", name: "Threading the Fence", playable: true },
      { id: "2.3", name: "On Station" },
      { id: "2.4", name: "Read-Only" },
      { id: "2.5", name: "Retask" },
      { id: "2.6", name: "FA Says No" },
    ],
  },
  {
    no: "W3",
    name: "Curve Following",
    levels: [
      { id: "3.1", name: "First Curve" },
      { id: "3.2", name: "Canyon" },
      { id: "3.3", name: "Append" },
      { id: "3.4", name: "Exit Strategy" },
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
