// Dev aid: run the reference brain against level 1.2 and print the message log,
// final vehicle state, and scores to stdout — for eyeballing the
// handshake -> command -> arrival arc. Not part of CI.
//
// Usage: npm run run:1.2
import { initWorld, scoreWorld, step, type World } from "@brain-swap/core";
import { level12, level12ReferenceBrain, scenarioFor } from "@brain-swap/levels";

function fmtDisposition(d: World["log"][number]["disposition"]): string {
  return d.kind === "rejected" ? `rejected:${d.reason}` : d.kind;
}

function main(): void {
  const scenario = scenarioFor(level12, level12ReferenceBrain);
  let w = initWorld(scenario);
  const maxTicks = level12.maxTicks;
  while (w.outcome === "running" && w.tick < maxTicks) w = step(w);

  process.stdout.write(`Level ${level12.id} — ${level12.title}\n`);
  process.stdout.write(`Body: ${scenario.body.name}\n\n`);
  process.stdout.write("tick  from->to   type                          disposition   brainState\n");

  // Re-run, printing per-tick (cheap; determinism guarantees identical output).
  let r = initWorld(scenario);
  while (r.outcome === "running" && r.tick < maxTicks) {
    const prevLen = r.log.length;
    r = step(r);
    for (const e of r.log.slice(prevLen)) {
      process.stdout.write(
        `${String(e.tick).padStart(4)}  ${`${e.from}->${e.to}`.padEnd(9)} ${e.type.padEnd(30)} ${fmtDisposition(
          e.disposition,
        ).padEnd(13)} ${r.ma.brainState ?? "-"}\n`,
      );
    }
  }

  const v = w.vehicle;
  process.stdout.write(
    `\noutcome=${w.outcome}  ticks=${w.tick}  pos=(${v.x.toFixed(1)}, ${v.y.toFixed(1)})  alt=${v.altitude}  hdg=${v.heading}  spd=${v.speed}\n`,
  );
  const s = scoreWorld(w);
  process.stdout.write(
    `score: ticks=${s.ticks} busTraffic=${s.busTraffic} rejections=${s.rejections} brainSize=${s.brainSize}\n`,
  );
}

main();
