import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Encodes CLAUDE.md hard rule #3 as CI: the sim core must be deterministic and
// headless — no RNG, no DOM, no wall-clock. Banned tokens never appear in
// packages/core/src. (Comments/strings included intentionally: keep the rule
// absolute and easy to reason about.)
const SRC = new URL("../src", import.meta.url).pathname;

const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /\bMath\.random\b/, why: "RNG breaks determinism" },
  { pattern: /\bDate\.(now|parse|UTC)\b/, why: "wall-clock breaks determinism" },
  { pattern: /\bnew Date\b/, why: "wall-clock breaks determinism" },
  { pattern: /\bperformance\.now\b/, why: "wall-clock breaks determinism" },
  { pattern: /\bwindow\b/, why: "DOM has no place in the headless core" },
  { pattern: /\bdocument\b/, why: "DOM has no place in the headless core" },
];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("core determinism guardrails", () => {
  it("packages/core/src contains no RNG / wall-clock / DOM tokens", () => {
    const offenders: string[] = [];
    for (const file of tsFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const { pattern, why } of BANNED) {
        if (pattern.test(text)) {
          offenders.push(`${file}: ${pattern} (${why})`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
