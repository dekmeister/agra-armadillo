/**
 * Deterministic seeded PRNG (mulberry32).
 *
 * The whole simulation must be a pure function of `(scenario, seed)` so that a
 * scenario can be replayed byte-identically and swept over thousands of seeds
 * headlessly. The RNG's internal state is therefore a single 32-bit integer that
 * lives inside `GameState`; every tick reconstructs the generator from that
 * integer, draws from it, and writes the advanced state back.
 */
export class Rng {
  /** Internal 32-bit state — serialise this into GameState to resume deterministically. */
  state: number;

  constructor(seed: number) {
    // Coerce to uint32 so a fractional/negative seed still produces a stable stream.
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  float(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let a = this.state;
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** Bernoulli trial: true with probability p. */
  chance(p: number): boolean {
    return this.float() < p;
  }
}
