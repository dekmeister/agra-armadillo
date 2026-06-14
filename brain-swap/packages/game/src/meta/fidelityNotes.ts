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
  { index: 3, title: "Discrete ticks", body: "\"Periodic\" rates map to every-N-ticks; everything is deterministic and replayable. Real systems are asynchronous." },
  { index: 4, title: "Short IDs", body: "CMD-1, CAP-HSA instead of UUIDs. Correlation semantics (CommandID ↔ status, CapabilityID ↔ control) are preserved; only the format is shortened." },
  { index: 5, title: "Pruned field sets", body: "Each message shows the interaction-required fields plus discriminators. Security markings, timestamps, and most optional fields are omitted. Kept fields are never renamed." },
  { index: 6, title: "2D world + altitude scalar", body: "Point-mass aircraft with turn/climb/accel limits; position maps Longitude→x, Latitude→y. Real kinematics are full 3D. The shape of the performance profile is real." },
  { index: 7, title: "Objectives arrive by magic", body: "Real missions arrive via C2/Mission Planning. Those are different L1 interfaces, out of this game's boundary." },
  { index: 8, title: "Silent ignore when not in control", body: "ControlStatus with no SecondaryController = not accepting inputs. The spec defines no explicit NACK for non-controllers, so FA visibly drops such commands in the log rather than inventing a rejection reason." },
  { index: 9, title: "FA validators are deterministic", body: "A-GRA specifies the interface, not FA internals — real vendor FAs differ run-to-run. The game makes them learnable." },
  { index: 10, title: "Curve constants auto-filled", body: "Weights = 1.0 and the clamped knot vector are fixed by the spec; the game fills them and shows them read-only. (Curve levels.)" },
  { index: 11, title: "Compliance scoring is per-level", body: "Judged by our FA referee in the style of the official harness; passing Brain Swap is not A-GRA compliance." },
  { index: 12, title: "Holding a zone = flying slowly through it", body: "A fixed-wing body can't hover (MinAirspeed > 0). The 1.2 \"enter-and-hold\" win is satisfied by slowing near min airspeed and transiting the zone; the brain consumes position reports to decide when to slow." },
  { index: 13, title: "Control correlation by CapabilityID", body: "The real handshake links control via Controllee/ControlType and identifies controllers by SystemID; the game correlates by CapabilityID. Every field name shown is real." },
];

export function notesFor(indices: readonly number[] | undefined): FidelityNote[] {
  if (!indices) return [];
  return indices
    .map((i) => FIDELITY_NOTES.find((n) => n.index === i))
    .filter((n): n is FidelityNote => !!n);
}
