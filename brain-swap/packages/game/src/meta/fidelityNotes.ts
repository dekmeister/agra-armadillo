// The "lies we tell" list (docs/02 §3), surfaced in-game per level via level.fidelityNotes
// (1-based indices into this list). KEEP IN SYNC with docs/02-fidelity.md §3 — that doc is
// the source of truth; this is a presentation copy. Titles are short; bodies paraphrase.
export interface FidelityNote {
  index: number;
  title: string;
  body: string;
}

export const FIDELITY_NOTES: FidelityNote[] = [
  { index: 1, title: "FA collapses the safety-critical side", body: "Real architecture has a VI OMS Isolator at the Airworthiness Boundary; the game collapses isolator + VMS + FA into one character, \"FA\"." },
  { index: 2, title: "One MA, one vehicle, perfect bus", body: "Real A-GRA is pub/sub over an Abstract Service Bus with QoS and out-of-order delivery. The game uses a single in-order bus with 1-tick delivery." },
  { index: 3, title: "Discrete ticks", body: "\"Periodic\" rates map to every-N-ticks; everything is deterministic and replayable. Real systems are asynchronous. Realtime mode paces tick advance on a wall-clock and pauses while you compose, but the sim itself stays tick-discrete — the recorded session replays identically." },
  { index: 4, title: "Short IDs", body: "CMD-1, MULE-01 instead of UUIDs. Correlation semantics (CommandID ↔ status, CapabilityID ↔ control) are preserved; only the format is shortened." },
  { index: 5, title: "Pruned field sets", body: "Each message shows the interaction-required fields plus discriminators. Security markings, timestamps, and most optional fields are omitted. Kept fields are never renamed." },
  { index: 6, title: "2D world + altitude scalar", body: "Point-mass aircraft with turn/climb/accel limits; position maps Longitude→x, Latitude→y. Real kinematics are full 3D. The shape of the performance profile is real." },
  { index: 7, title: "Objectives arrive by magic", body: "Real missions arrive via C2/Mission Planning. Those are different L1 interfaces, out of this game's boundary." },
  { index: 8, title: "Silent ignore when not in control", body: "ControlStatus with no SecondaryController = not accepting inputs. The spec defines no explicit NACK for non-controllers, so FA visibly drops such commands in the log rather than inventing a rejection reason." },
  { index: 9, title: "FA validators are deterministic", body: "A-GRA specifies the interface, not FA internals — real vendor FAs differ run-to-run. The game makes them learnable." },
  { index: 10, title: "Curve constants auto-filled", body: "Weights = 1.0 and the clamped knot vector are fixed by the spec; the game fills them and shows them read-only. (Curve levels.)" },
  { index: 11, title: "Compliance scoring is per-level", body: "Judged by our FA referee in the style of the official harness; passing Brain Swap is not A-GRA compliance." },
  { index: 12, title: "Holding a zone = flying slowly through it", body: "A fixed-wing body can't hover (MinAirspeed > 0). The 1.2 \"enter-and-hold\" win is satisfied by slowing near min airspeed and transiting the zone; the brain consumes position reports to decide when to slow." },
  { index: 13, title: "Control correlation by CapabilityID", body: "The real handshake links control via Controllee/ControlType and identifies controllers by SystemID; the game correlates by CapabilityID. Every field name shown is real." },
  { index: 14, title: "The performance envelope is static", body: "Real FA republishes the profile as flight conditions change (e.g. the ceiling rises as fuel burns off). Level 1.3 advertises the envelope once at boot; the lesson is only \"read the profile, don't hardcode.\" A fuel-coupled envelope needs a burn model + event schedule (a later world)." },
  { index: 15, title: "The racetrack is flown by position thresholds", body: "Real loiter (Racetrack/Circle, §1.2.2.3) has FA-managed timed legs. Level 1.4 hand-steers a four-corner circuit, issuing a Direction-only UPDATE when a position report crosses a corner threshold. No brain timer yet, so legs are geometric, not timed; waypoint zones sit on the straights where position is stable." },
  { index: 16, title: "The Type Certificate is graded headless", body: "The 4.5 \"one locked brain across the whole fleet\" proof runs in the test harness (worst-of-three via aggregateWorst). In-game the level runs on its primary body only; there is no multi-body score-screen UI yet." },
  { index: 17, title: "Fuel is a flat scalar with a U-curve burn", body: "Real endurance carries Fuel (a MassType), Duration, DurationEnd, and Percent. The game prunes NavigationReportMT to flat Fuel (kg) + Percent and burns a U-shaped fuel flow minBurn + burnQuad*(speed-bestSpeed)^2 — minimum a bit above the stall, rising steeply with speed. Deterministic and learnable, not real aerodynamics. FA's VIOLATION_ENDURANCE check is a single endurance-reserve threshold. (Level 1.6 Bingo.)" },
];

export function notesFor(indices: readonly number[] | undefined): FidelityNote[] {
  if (!indices) return [];
  return indices
    .map((i) => FIDELITY_NOTES.find((n) => n.index === i))
    .filter((n): n is FidelityNote => !!n);
}
