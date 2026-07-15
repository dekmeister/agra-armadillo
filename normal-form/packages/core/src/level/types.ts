// Sheet = a certification job as data (docs/04, 05-mvp JSON sketch). The core
// runtime reads `requestee`, `seeds`, and the opening command; the rest
// (palette, compose fields, cites, fidelity notes, recap) is carried data consumed
// by the validator (S3) and UI (S4+). Certification is pass/fail — no scoring/pars.
import type { CommandStateEnum } from "../messages/index.ts";
import type { RequesteeConfig } from "../requestee/index.ts";
import type { Seed } from "../seeds.ts";
import type { WinClause } from "./goal.ts";

export type { WinClause };

export interface Goal {
  readonly text: string;
  readonly win: { readonly all: readonly WinClause[] };
}

export interface Lifeline {
  readonly id: string;
  readonly label: string;
  readonly player?: boolean;
}

export interface PaletteEntry {
  readonly pattern: string;
  readonly unlocked: boolean;
  readonly binding?: { readonly request: string; readonly response: string };
  /** one-way (`-1`) publication message name (Status-1/Data-1) — no response leg. */
  readonly publication?: string;
  readonly cite?: string;
}

/** The opening TaskCommand the sheet places for the player to fix and fire. */
export interface OpeningCommand {
  readonly commandId: string;
  readonly commandState: CommandStateEnum;
}

export interface ComposeSpec {
  readonly initialFields: Readonly<Record<string, string | null>>;
  readonly editable: readonly string[];
  /** the Mode the sheet certifies against, when it differs from the (deliberately
   *  wrong) initial `Mode` — drives the "arrives broken" Mode beat (W0's EXERCISE
   *  sheet). Absent ⇒ the initial Mode is the expected one (1-1/1-2). */
  readonly expectedMode?: string;
}

/** What a certification job asks for — determines the one correct palette pattern
 *  (or that it is a trap). 0-3 (`-1` classification): `status` → Status-1, `datum` →
 *  Data-1, `request` → a trap (no `-1` can answer a request; passed by filing the
 *  wrong-palette finding). 1-4 (`-2` classification): `dataRequest` → DataRequest-2
 *  (obtain existing data), `actionRequest` → ActionRequest-2 (run a process); the
 *  other patterns — including Command-2 — dead-end the job. */
export type JobAsk = "status" | "datum" | "request" | "dataRequest" | "actionRequest";

/** One certification job on a classification sheet (0-3). The player assigns a
 *  palette pattern to each (or files a finding); the goal judges each job's outcome. */
export interface Job {
  readonly id: string;
  readonly prompt: string;
  /** the consumer lifeline this job serves */
  readonly party: string;
  readonly ask: JobAsk;
}

/** The single palette pattern that correctly serves a job's ask, or null when the
 *  ask is a trap that no `-1` primitive can satisfy (a request needs a `-2`). */
export function correctPatternFor(ask: JobAsk): string | null {
  switch (ask) {
    case "status":
      return "Status-1";
    case "datum":
      return "Data-1";
    case "request":
      return null;
    case "dataRequest":
      return "DataRequest-2";
    case "actionRequest":
      return "ActionRequest-2";
  }
}

/** Marks a one-way (`-1`) sheet and carries its sim knobs. Presence selects the
 *  producer sim path (`runSeedOneWay`) over the Command-2 path. The producer is the
 *  player lifeline; every other lifeline is a consumer. */
export interface OneWaySpec {
  /** ticks a consumer holds a datum after a received publication before it goes
   *  stale (Data-1 hold goals). Irrelevant to deadline goals (Status-1). */
  readonly staleAfter?: number;
  /** ticks between a publish and its receipt at a consumer (defaults to 1). */
  readonly latency?: number;
}

/** Marks a request-run sheet (bonus 1-5) and carries its sim knobs. Presence selects
 *  the request-run sim path (`runSeedRequest`): one ActionRequest-2 conversation that
 *  the requestee works QUEUED→PROCESSING→COMPLETED (activity executes at COMPLETED)
 *  unless a player-injected CANCEL is *received before* it commits COMPLETED, in which
 *  case it transitions to CANCELED and the activity never runs. The player lifeline is
 *  the requester; the non-player lifeline is the requestee. All ticks are relative to
 *  the requestee's receipt of the opening request (`latency` after send). */
export interface RequestSpec {
  /** ticks a request/cancel takes to travel from requester to requestee (default 1). */
  readonly latency?: number;
  /** ticks after receipt at which the requestee reports QUEUED. */
  readonly queuedAt: number;
  /** ticks after receipt at which it reports PROCESSING. */
  readonly processingAt: number;
  /** ticks after receipt at which it commits COMPLETED (and the activity executes),
   *  unless a CANCEL was received strictly before this tick. */
  readonly completesAt: number;
  /** the cancel-injection tick the sheet ships with — `null` (no cancel) leaves the
   *  sheet deliberately broken (the activity runs), so the fail-then-fix beat fires. */
  readonly defaultCancelAt?: number | null;
}

export interface Sheet {
  readonly id: string;
  readonly world: string;
  readonly title: string;
  readonly goal: Goal;
  readonly palette: readonly PaletteEntry[];
  readonly lifelines: readonly Lifeline[];
  readonly compose: ComposeSpec;
  /** the opening command (Command-2 / request sheets only; absent on `-1`). */
  readonly opening?: OpeningCommand;
  /** the scripted respondent (Command-2 / request sheets only; absent on `-1`). */
  readonly requestee?: RequesteeConfig;
  /** present on `-1` sheets — selects the one-way producer sim path. */
  readonly oneway?: OneWaySpec;
  /** present on a classification sheet (0-3) — the per-job pattern-choice jobs.
   *  Selects the jobs sim path (`runSeedJobs`) over the single-composition paths. */
  readonly jobs?: readonly Job[];
  /** present on the request-run sheet (bonus 1-5) — selects `runSeedRequest`. */
  readonly request?: RequestSpec;
  /** an optional, skippable bonus sheet — marked on the drawing index; it never gates
   *  progression (it is terminal in `SHEET_LIST`, so nothing unlocks *from* it). */
  readonly bonus?: boolean;
  readonly seeds: readonly Seed[];
  /** the one-line lesson shown on the CERTIFIED stamp (docs/03-levels). */
  readonly recap: string;
  readonly fidelityNotes?: readonly string[];
  readonly cites?: readonly string[];
  /** hard cap on run length; defaults to the last scheduled delivery */
  readonly maxTicks?: number;
}
