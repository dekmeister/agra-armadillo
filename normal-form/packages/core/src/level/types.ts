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
  readonly seeds: readonly Seed[];
  /** the one-line lesson shown on the CERTIFIED stamp (docs/03-levels). */
  readonly recap: string;
  readonly fidelityNotes?: readonly string[];
  readonly cites?: readonly string[];
  /** hard cap on run length; defaults to the last scheduled delivery */
  readonly maxTicks?: number;
}
