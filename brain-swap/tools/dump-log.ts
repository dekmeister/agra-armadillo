// Dev aid (not CI): run a level + brain headless and print the projected golden
// log, the MA send sequence, the final vehicle state, and the score — for
// authoring golden tests and eyeballing new levels.
//
// Usage: npx tsx tools/dump-log.ts <levelKey> [brainKey]
//   levelKey : 00 | 11 | 12 | 13 | 14 | 16 | 22 | 45
//   brainKey : ref (default) | naive | locked | none
import {
  type BodyProfile,
  type Brain,
  initWorld,
  type LevelDef,
  makeScenario,
  run,
  scoreWorld,
  type World,
} from "@brain-swap/core";
import * as L from "@brain-swap/levels";

type BrainKey = "ref" | "naive" | "locked";
interface LevelEntry {
  level: LevelDef;
  ref?: Brain;
  naive?: Brain;
  locked?: Brain;
}

const levels: Record<string, LevelEntry> = {
  "00": { level: L.level00, ref: L.level00ReferenceBrain },
  "11": { level: L.level11, ref: L.level11ReferenceBrain, naive: L.level11NaiveBrain },
  "12": { level: L.level12, ref: L.level12ReferenceBrain },
  "13": { level: L.level13, ref: L.level13ReferenceBrain, naive: L.level13NaiveBrain },
  "14": { level: L.level14, ref: L.level14ReferenceBrain },
  "16": { level: L.level16, ref: L.level16ReferenceBrain, naive: L.level16NaiveBrain },
  "22": { level: L.level22, ref: L.level22ReferenceBrain, naive: L.level22NaiveBrain },
  "42": { level: L.level42, ref: L.level42ReferenceBrain, naive: L.level42NaiveBrain },
  "43": { level: L.level43, ref: L.level43ReferenceBrain, naive: L.level43NaiveBrain },
  "45": { level: L.level45, locked: L.level45LockedBrain },
};

const levelKey = process.argv[2] ?? "12";
const brainKey = process.argv[3] ?? "ref";
const entry = levels[levelKey];
if (!entry) throw new Error(`unknown level key: ${levelKey}`);

function pickBrain(): Brain | null {
  if (brainKey === "none") return null;
  const b = entry?.[brainKey as BrainKey];
  if (!b) throw new Error(`level ${levelKey} has no '${brainKey}' brain`);
  return b;
}

function dumpFor(level: LevelDef, body: BodyProfile, brain: Brain | null): void {
  const scenario = makeScenario(body, { brain, level });
  const w: World = run(initWorld(scenario), 1000);
  process.stdout.write(`\n=== ${level.id} on ${body.name} (${brainKey}) ===\n`);
  for (const e of w.log) {
    process.stdout.write(`"t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]",\n`);
  }
  const sends = w.log
    .filter((e) => e.from === "MA")
    .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
  process.stdout.write(`\nMA sends:\n${JSON.stringify(sends, null, 2)}\n`);
  const v = w.vehicle;
  process.stdout.write(
    `\noutcome=${w.outcome} ticks=${w.tick} holdTicks=${w.holdTicks} wpIndex=${w.waypointIndex} pos=(${v.x.toFixed(1)},${v.y.toFixed(1)}) alt=${v.altitude.toFixed(0)} hdg=${v.heading.toFixed(1)} spd=${v.speed.toFixed(1)}\n`,
  );
  process.stdout.write(`score=${JSON.stringify(scoreWorld(w))}\n`);
}

const brain = pickBrain();
if (entry.level.bodies) {
  for (const id of entry.level.bodies) dumpFor(entry.level, L.bodyById(id), brain);
} else {
  dumpFor(entry.level, L.bodyById(entry.level.body), brain);
}
