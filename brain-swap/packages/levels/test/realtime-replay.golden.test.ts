import { describe, expect, it } from "vitest";
import {
  type Brain,
  extractScript,
  initWorld,
  type LevelDef,
  makeScenario,
  type MessageLogEntry,
  replayScript,
  run,
  type Scenario,
  scoreWorld,
  type ScriptedInput,
  type World,
} from "@brain-swap/core";
import {
  level11,
  level11ReferenceBrain,
  level12,
  level12ReferenceBrain,
  level13,
  level13ReferenceBrain,
  level14,
  level14ReferenceBrain,
  level16,
  level16ReferenceBrain,
  level22,
  level22ReferenceBrain,
  level45,
  level45LockedBrain,
  multiBodyScenarios,
} from "@brain-swap/levels";

// Realtime mode: the player *is* the MA brain — they inject MA→FA messages by
// hand instead of building a state machine. A session is a recorded input script
// (`ScriptedInput[]`); replaying it must be deterministic and must reproduce the
// run (CLAUDE.md rule #3). We prove every shipped level is still solvable by hand
// by deriving a script from its reference brain (extractScript) and replaying it
// through a brainless scenario (replayScript). The replay must win with the same
// MA sends and the same score. (The full log is byte-STABLE across replays but
// may differ from the brain run in the within-tick order of an MA send vs an FA
// publication — see extractScript's note — so we assert MA-send + score parity,
// not brain-log identity.)

const MAX_STEPS = (level: LevelDef) => level.maxTicks ?? 500;

interface Case {
  readonly id: string;
  readonly level: LevelDef;
  readonly brain: Brain;
}

const CASES: Case[] = [
  { id: "1.1", level: level11, brain: level11ReferenceBrain },
  { id: "1.2", level: level12, brain: level12ReferenceBrain },
  { id: "1.3", level: level13, brain: level13ReferenceBrain },
  { id: "1.4", level: level14, brain: level14ReferenceBrain },
  { id: "1.6", level: level16, brain: level16ReferenceBrain },
  { id: "2.2", level: level22, brain: level22ReferenceBrain },
  { id: "4.5", level: level45, brain: level45LockedBrain },
];

const maSends = (log: readonly MessageLogEntry[]) =>
  log
    .filter((e) => e.from === "MA")
    .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));

/** Run the reference brain headless and derive the realtime input script from it. */
function deriveScript(scenario: Scenario, maxSteps: number): { brainRun: World; script: ScriptedInput[] } {
  const brainRun = run(initWorld(scenario), maxSteps);
  return { brainRun, script: extractScript([brainRun]) };
}

function brainlessOf(scenario: Scenario): Scenario {
  return makeScenario(scenario.body, { brain: null, level: scenario.level });
}

describe("realtime replay — every level is solvable by hand", () => {
  for (const c of CASES) {
    // multiBodyScenarios covers single-body levels (one scenario) and 4.5 (one per airframe).
    const scenarios = multiBodyScenarios(c.level, c.brain);
    scenarios.forEach((brainScenario, i) => {
      const tag = scenarios.length > 1 ? `${c.id} · ${brainScenario.body.id}` : c.id;
      const maxSteps = MAX_STEPS(c.level);

      it(`${tag}: a replayed hand-flown script wins with the brain's sends and score`, () => {
        const { brainRun, script } = deriveScript(brainScenario, maxSteps);
        expect(brainRun.outcome).toBe("won");

        const frames = replayScript(brainlessOf(brainScenario), script, maxSteps);
        const final = frames[frames.length - 1]!;
        expect(final.outcome).toBe("won");

        // The hand-flown session issues exactly the brain's MA→FA messages.
        expect(maSends(final.log)).toEqual(maSends(brainRun.log));

        // Same score, ignoring brainSize (no brain in realtime).
        const { brainSize: _b, ...replayScore } = scoreWorld(final);
        const { brainSize: _b2, ...brainScore } = scoreWorld(brainRun);
        expect(replayScore).toEqual(brainScore);
      });

      it(`${tag}: replay is deterministic (two runs are byte-identical)`, () => {
        const { script } = deriveScript(brainScenario, maxSteps);
        const a = replayScript(brainlessOf(brainScenario), script, maxSteps);
        const b = replayScript(brainlessOf(brainScenario), script, maxSteps);
        expect(JSON.stringify(a.map((w) => w.log))).toBe(JSON.stringify(b.map((w) => w.log)));
      });
    });
  }
});
