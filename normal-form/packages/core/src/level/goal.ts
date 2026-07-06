// The declarative goal evaluator (WS-E). A sheet's goal is judged by world-state,
// never "message sent" — and the world-state clauses are *data* (`Goal.win.all`),
// read by the sim, not hardcoded. Both sim paths (Command-2 `runSeed`, one-way
// `runSeedOneWay`) build a per-tick `WinSnapshot` timeline and hand it here.
//
// A clause is a discriminated union keyed by its one distinctive field:
//  - `worldState: "activityExecuted"` — a requestee performed the tasked activity.
//  - `holdsProof`                      — a requester acted on proof (Command-2). (The
//    honest operational check: the machine held ACCEPTED at least once. Not
//    "reached terminal" — a non-terminal machine can still hold proof once, which
//    is exactly what the 1-1 negative goldens rely on.)
//  - `statusShownBy { byTick }`        — a `-1` consumer was shown a status by a
//    deadline tick.
//  - `heldContinuously { fromTick, toTick }` — a `-1` consumer held a fresh datum
//    at every tick across a closed interval.
// Every clause names the `party` (lifeline id) it is about.

/** A requestee performed the tasked activity (Command-2 / request patterns). */
export interface ActivityExecutedClause {
  readonly worldState: "activityExecuted";
  readonly party: string;
}

/** A requester acted on proof at least once (Command-2). */
export interface HoldsProofClause {
  readonly holdsProof: true;
  readonly party: string;
}

/** A `-1` consumer was shown a status at or before `byTick` (deadline). */
export interface StatusShownByClause {
  readonly statusShownBy: { readonly party: string; readonly byTick: number };
}

/** A `-1` consumer held a fresh datum at every tick in `[fromTick, toTick]`. */
export interface HeldContinuouslyClause {
  readonly heldContinuously: {
    readonly party: string;
    readonly fromTick: number;
    readonly toTick: number;
  };
}

export type WinClause =
  | ActivityExecutedClause
  | HoldsProofClause
  | StatusShownByClause
  | HeldContinuouslyClause;

/** World-state at the end of a single tick. Sets are cumulative where the fact is
 *  monotonic (`activityExecuted`, `proofHeld`, `statusShown`) and per-tick where it
 *  is not (`datumHeld` — a datum goes stale). Members are party (lifeline) ids. */
export interface WinSnapshot {
  readonly activityExecuted: ReadonlySet<string>;
  readonly proofHeld: ReadonlySet<string>;
  readonly statusShown: ReadonlySet<string>;
  readonly datumHeld: ReadonlySet<string>;
}

/** The earliest tick a `statusShown` party appears, or null if never. */
function firstShown(timeline: readonly WinSnapshot[], party: string): number | null {
  for (let t = 0; t < timeline.length; t++) {
    if (timeline[t]!.statusShown.has(party)) return t;
  }
  return null;
}

/** Does one clause hold, evaluated at tick `t` over the whole `timeline`? */
function clauseHoldsAt(clause: WinClause, timeline: readonly WinSnapshot[], t: number): boolean {
  const snap = timeline[t]!;
  if ("worldState" in clause) return snap.activityExecuted.has(clause.party);
  if ("holdsProof" in clause) return snap.proofHeld.has(clause.party);
  if ("statusShownBy" in clause) {
    const { party, byTick } = clause.statusShownBy;
    const shown = firstShown(timeline, party);
    return shown !== null && shown <= byTick && t >= shown;
  }
  // heldContinuously: only determinable at/after the window closes.
  const { party, fromTick, toTick } = clause.heldContinuously;
  if (t < toTick) return false;
  for (let u = fromTick; u <= toTick; u++) {
    if (u >= timeline.length || !timeline[u]!.datumHeld.has(party)) return false;
  }
  return true;
}

/** Do all clauses hold, evaluated at tick `t` over `timeline`? (Interval clauses
 *  look ahead, so pass the *full* timeline; the Command-2 clauses are monotonic and
 *  read only up to `t`, so an incrementally-grown timeline is also sound there.) */
export function goalHoldsAt(
  all: readonly WinClause[],
  timeline: readonly WinSnapshot[],
  t: number,
): boolean {
  return all.every((c) => clauseHoldsAt(c, timeline, t));
}

/** The first tick at which every clause in `all` holds simultaneously, or null. */
export function evaluateGoal(
  all: readonly WinClause[],
  timeline: readonly WinSnapshot[],
): number | null {
  for (let t = 0; t < timeline.length; t++) {
    if (goalHoldsAt(all, timeline, t)) return t;
  }
  return null;
}
