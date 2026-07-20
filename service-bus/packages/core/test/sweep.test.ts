/**
 * The published strategy win rates (WP6.5).
 *
 * These numbers are the game's headline empirical claim — the debrief shows them to the
 * player after a Phase 6 outcome, and the README has quoted them since the MVP. Until now
 * nothing checked them: they were prose next to a command nobody re-ran, free to drift the
 * moment Phase 6 was retuned (which WP5 did, twice).
 *
 * The sim is a pure function of (scenario, seed), so the right assertion is EXACT equality,
 * not a tolerance band — a band would let a real regression hide inside it. The full sweep
 * is ~4 s, which is a fair price for a guard on the one statistic the game asserts.
 *
 * If this fails, the fix is to re-run the sweep and update `STRATEGY_WIN_RATES` *and* the
 * README together — never to widen the assertion.
 */
import { describe, expect, it } from "vitest";
import { STRATEGY_WIN_RATES, SWEEP_SEEDS, strategyWinRate } from "../src/index.ts";

// ~4 s of honest computation across four 500-seed sweeps; the default 5 s budget is tight
// once vitest is running files in parallel.
const SWEEP_TIMEOUT = 30_000;

describe("Phase 6 strategy sweep", () => {
  it(
    "reproduces every published win rate exactly",
    () => {
      for (const { strategy, rate } of STRATEGY_WIN_RATES) {
        expect(strategyWinRate(strategy, SWEEP_SEEDS), strategy).toBeCloseTo(rate, 3);
      }
    },
    SWEEP_TIMEOUT,
  );

  it(
    "EDF and Class agree, which is why the strip shows them as one row",
    () => {
      expect(strategyWinRate("edf", SWEEP_SEEDS)).toBeCloseTo(
        strategyWinRate("class", SWEEP_SEEDS),
        3,
      );
    },
    SWEEP_TIMEOUT,
  );

  /**
   * The teaching claim itself, independent of the exact numbers: rerouting beats
   * re-prioritising, both beat passivity, and re-requesting onto the same degraded link is
   * worse than doing nothing at all. If a retune ever inverts that last one, the game stops
   * teaching "delivery ≠ approval, and retrying is not recovery" and the copy must change.
   */
  it("preserves the ordering the game teaches", () => {
    const rate = (s: string) =>
      STRATEGY_WIN_RATES.find((r) => r.strategy === s)?.rate ?? Number.NaN;
    expect(rate("reroute")).toBeGreaterThan(rate("class"));
    expect(rate("class")).toBeGreaterThan(rate("none"));
    expect(rate("rerequest")).toBeLessThan(rate("none"));
  });

  it("is published in descending order, so the strip reads as a ranking", () => {
    const rates = STRATEGY_WIN_RATES.map((r) => r.rate);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates);
  });
});
