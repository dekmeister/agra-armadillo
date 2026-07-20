/**
 * Headless parameter-sweep harness — the "RF sandbox".
 *
 * Runs the deterministic core over a band of seeds under a chosen recovery strategy and
 * emits a CSV of {seed, outcome, completionTick, failReason}. Because the sim is a pure
 * function of (scenario, seed), the same invocation reproduces byte-identically — so you
 * can sweep p_loss / burstiness / policy and plot outcome distributions without a browser.
 *
 * This is now a thin CLI: the actual sweep lives in `@service-bus/core`'s `sweep.ts`, so
 * the tool, the in-game strategy strip (WP6.5) and the regression test that pins the
 * published win rates all run the same code.
 *
 * Usage:
 *   npm run sweep -- scenarios/phase6.json --seeds 1000 --strategy edf --at 4
 *   npm run sweep -- scenarios/phase6.json --seed 1..200 --strategy reroute
 *   npm run sweep -- scenarios/phase6.json --compare --seeds 500
 *
 * Strategies: none|fifo (do nothing) · edf · class · reroute · rerequest.
 * CSV goes to stdout; a summary goes to stderr.
 */
import { readFileSync } from "node:fs";
import type { Strategy } from "@service-bus/core";
import { SWEEP_STRATEGIES, sweep, winRate } from "@service-bus/core";

interface Args {
  scenarioPath: string | null;
  seedLo: number;
  seedHi: number;
  strategy: Strategy;
  at: number;
  maxTicks: number;
  compare: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    scenarioPath: null,
    seedLo: 1,
    seedHi: 200,
    strategy: "none",
    at: 4,
    maxTicks: 60,
    compare: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (!arg.startsWith("--") && arg.endsWith(".json")) {
      a.scenarioPath = arg;
    } else if (arg === "--compare") {
      a.compare = true;
    } else if (arg === "--seeds") {
      a.seedHi = Number(argv[++i]);
      a.seedLo = 1;
    } else if (arg === "--seed") {
      const [lo, hi] = String(argv[++i]).split("..");
      a.seedLo = Number(lo);
      a.seedHi = hi === undefined ? Number(lo) : Number(hi);
    } else if (arg === "--strategy") {
      a.strategy = argv[++i] as Strategy;
    } else if (arg === "--at") {
      a.at = Number(argv[++i]);
    } else if (arg === "--max") {
      a.maxTicks = Number(argv[++i]);
    }
  }
  return a;
}

function loadConfig(path: string | null): Record<string, unknown> {
  if (!path) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as { config?: Record<string, unknown> };
  return raw.config ?? {};
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const opts = { config: loadConfig(args.scenarioPath), at: args.at, maxTicks: args.maxTicks };

  if (args.compare) {
    process.stderr.write(
      `Comparing strategies over seeds ${args.seedLo}..${args.seedHi} (recovery @ tick ${args.at}):\n`,
    );
    process.stdout.write("strategy,win_rate,wins,n\n");
    for (const strat of SWEEP_STRATEGIES) {
      const r = sweep(strat, args.seedLo, args.seedHi, opts);
      const wins = r.filter((x) => x.outcome === "win").length;
      process.stdout.write(`${strat},${winRate(r).toFixed(3)},${wins},${r.length}\n`);
    }
    return;
  }

  const results = sweep(args.strategy, args.seedLo, args.seedHi, opts);
  process.stdout.write("seed,outcome,completion_tick,fail_reason\n");
  for (const r of results) {
    process.stdout.write(`${r.seed},${r.outcome},${r.completionTick},"${r.failReason}"\n`);
  }
  process.stderr.write(
    `\n${args.strategy}: win rate ${(winRate(results) * 100).toFixed(1)}% over ${results.length} seeds (recovery @ tick ${args.at}).\n`,
  );
}

main();
