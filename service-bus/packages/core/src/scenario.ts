/**
 * Scenario registry — maps a scenarioId to its ScenarioDef. The engine resolves the
 * active level from `GameState.scenarioId` via `getScenario`; everything level-specific
 * lives in `./scenarios/*`. Phase 6 is the default for back-compat with the MVP slice
 * (and with `createInitialState(seed)` callers that predate the campaign).
 */
import type { ScenarioDef } from "./scenario-def.ts";
import { phase1 } from "./scenarios/phase1.ts";
import { phase2 } from "./scenarios/phase2.ts";
import { phase3 } from "./scenarios/phase3.ts";
import { phase4 } from "./scenarios/phase4.ts";
import { phase5 } from "./scenarios/phase5.ts";
import { phase6 } from "./scenarios/phase6.ts";
import { phase7 } from "./scenarios/phase7.ts";
import { phase8 } from "./scenarios/phase8.ts";

export type { ScenarioDef, ScenarioOpts } from "./scenario-def.ts";
export { buildPhase6, DEFAULT_CONFIG, TUTORIAL_SEED } from "./scenarios/phase6.ts";

export const SCENARIOS: Record<string, ScenarioDef> = {
  phase1,
  phase2,
  phase3,
  phase4,
  phase5,
  phase6,
  phase7,
  phase8,
};

/** Levels in campaign order (for the picker / sweeps). */
export const CAMPAIGN: ScenarioDef[] = Object.values(SCENARIOS).sort((a, b) => a.phase - b.phase);

/** Resolve a level's descriptor; unknown ids fall back to Phase 6 (the MVP slice). */
export function getScenario(id: string): ScenarioDef {
  return SCENARIOS[id] ?? phase6;
}
