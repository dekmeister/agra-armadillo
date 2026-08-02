/**
 * UI copy-drift guard (WP3).
 *
 * The codex test (packages/core/test/codex.test.ts) proves the codex matches what
 * the sim emits. It cannot catch the other direction: prose in the view naming a
 * message the sim never sends. That is exactly what had happened — Phase 3's picker
 * blurb and Help text both cited `MA_PackageManagementCommandMT`, a real A-GRA type
 * the campaign does not use (Phase 3 emits `MA_LeaderUpdateRequestMT`).
 *
 * So: every `MA_*` token appearing anywhere in the view source must resolve to a
 * documented name. Scanning the whole of `src` rather than a fixed file list means
 * new copy is covered automatically.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KNOWN_MESSAGE_NAMES } from "../../core/src/index.ts";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const SCANNED = new Set([".ts", ".svelte"]);

/** Every scannable source file under packages/game/src. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return SCANNED.has(extname(full)) ? [full] : [];
  });
}

/**
 * `MA_` or `GAME_` followed by an identifier. Deliberately broad — it catches a name
 * that is merely misspelled as readily as one that is wholly invented. `GAME_` is in
 * scope too so the one deliberately game-local message name is held to the same
 * standard as the real ones, and so a stale `MA_SynchronizeGlobalCopToPeer` left in
 * prose would still be caught by the `MA_` half.
 */
const MA_TOKEN = /\b(?:MA|GAME)_[A-Za-z0-9_]+/g;

/**
 * Real A-GRA schema types the view *cites as provenance* but never sends. These are
 * not messages — they are the XSD complexTypes a claim is sourced to, so they will
 * never appear in `KNOWN_MESSAGE_NAMES`, and suppressing them by loosening the regex
 * would blunt the guard. Keep this list short: an entry is a promise that the name was
 * checked against `A-GRA_MessageDefinitions_v5_0_a.xsd`, not a way to quiet a failure.
 */
const CITED_SCHEMA_TYPES = new Set([
  "MA_LeadershipMetricsMDT", // carries PackageLeaderElectionMethod (election methods 0-3)
  "MA_OperatorRoleMDT", // shows a role is a ForeignKeyType + free text, not an enum (VERIFY C1)
  "MA_AuthorityCriteriaType", // type of ROE's TargetAuthorityCriteria — the Target-Authority gate
]);

describe("UI copy does not name messages the game never sends", () => {
  it("resolves every MA_* token in the view source to a documented name", () => {
    const known = new Set<string>([...KNOWN_MESSAGE_NAMES, ...CITED_SCHEMA_TYPES]);
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const token of text.match(MA_TOKEN) ?? []) {
        if (!known.has(token)) {
          offenders.push(`${file.slice(SRC.length + 1)}: ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("actually scans something (guards against a broken file walk)", () => {
    // Without this, a bad path would make the test above vacuously pass.
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(10);
    // Note: MA_TOKEN is /g, so `.test()` would be stateful across calls — match instead.
    const withTokens = files.filter((f) => (readFileSync(f, "utf8").match(MA_TOKEN) ?? []).length);
    expect(withTokens.length).toBeGreaterThan(0);
  });
});
