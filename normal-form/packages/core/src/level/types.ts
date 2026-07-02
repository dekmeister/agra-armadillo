// Sheet = a certification job as data (docs/04, 05-mvp JSON sketch). The core
// runtime reads `requestee`, `seeds`, `pars`, and the opening command; the rest
// (palette, compose fields, cites, fidelity notes) is carried data consumed by the
// validator (S3) and UI (S4+).
import type { CommandStateEnum } from "../messages/index.ts";
import type { RequesteeConfig } from "../requestee/index.ts";
import type { Seed } from "../seeds.ts";

export interface WinClause {
  readonly worldState?: "activityExecuted";
  readonly machineState?: "terminal";
  readonly party: string;
}

export interface Goal {
  readonly text: string;
  readonly win: { readonly all: readonly WinClause[] };
}

export interface Pars {
  readonly messages: number;
  readonly machineSize: number;
  readonly ticks: number;
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

export interface Sheet {
  readonly id: string;
  readonly world: string;
  readonly title: string;
  readonly goal: Goal;
  readonly palette: readonly PaletteEntry[];
  readonly lifelines: readonly Lifeline[];
  readonly compose: ComposeSpec;
  readonly opening: OpeningCommand;
  readonly requestee: RequesteeConfig;
  readonly seeds: readonly Seed[];
  readonly pars: Pars;
  readonly fidelityNotes?: readonly string[];
  readonly cites?: readonly string[];
  /** hard cap on run length; defaults to the last scheduled delivery */
  readonly maxTicks?: number;
}
