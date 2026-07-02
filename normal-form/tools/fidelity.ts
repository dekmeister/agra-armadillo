// Pure fidelity-check logic (docs/02-fidelity.md §5), shared by the CLI
// (check-fidelity.ts) and the vitest gate (fidelity.test.ts).
//
// Two token classes, two sources of truth:
//   • NAME tokens  — every message/type/field/enum name + enum literal in the
//     catalog — must appear as a name="…"/value="…" identifier in the UCI XSD.
//   • CERT tokens  — every CERT/RQMT number (UNIS-/USTD-/SCH-xxxxxx) inside any
//     `cite:` — must appear verbatim in the UCI .txt specifications.
// Unknown names or numbers fail the build. The game may omit; it may never
// rename or invent.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CatalogComplexType } from "./catalog-source.ts";
import { loadCatalog, REFS_DIR } from "./catalog-source.ts";

export interface Token {
  value: string;
  kind: "name" | "cert";
  owner: string;
}

const CERT_RE = /\b(?:UNIS|USTD|SCH)-\d{6}\b/g;

function complexTokens(t: CatalogComplexType, extraNames: string[] = []): Token[] {
  const tokens: Token[] = [{ value: t.name, kind: "name", owner: t.name }];
  for (const extra of extraNames) tokens.push({ value: extra, kind: "name", owner: t.name });
  for (const c of t.cite?.match(CERT_RE) ?? [])
    tokens.push({ value: c, kind: "cert", owner: t.name });
  for (const f of t.fields) {
    tokens.push({ value: f.name, kind: "name", owner: `${t.name}.${f.name}` });
    for (const c of f.cite?.match(CERT_RE) ?? []) {
      tokens.push({ value: c, kind: "cert", owner: `${t.name}.${f.name}` });
    }
  }
  return tokens;
}

/** Every catalog name (→ XSD) and CERT/RQMT number (→ txt) that must be real. */
export function collectTokens(): Token[] {
  const catalog = loadCatalog();
  const tokens: Token[] = [];

  for (const e of catalog.enums) {
    tokens.push({ value: e.name, kind: "name", owner: e.name });
    for (const v of e.values) tokens.push({ value: v, kind: "name", owner: e.name });
    for (const c of e.cite?.match(CERT_RE) ?? [])
      tokens.push({ value: c, kind: "cert", owner: e.name });
  }

  for (const t of [...catalog.envelope, ...catalog.types]) tokens.push(...complexTokens(t));
  for (const m of catalog.messages) tokens.push(...complexTokens(m, [m.mt]));

  return tokens;
}

/**
 * Index of quoted XSD `name="…"` / `value="…"` identifiers. Matching the quoted
 * form (not raw substrings) avoids false positives from unrelated text.
 */
export function buildXsdNameIndex(xsd: string): Set<string> {
  const index = new Set<string>();
  const re = /(?:name|value)="([A-Za-z0-9_]+)"/g;
  for (let m = re.exec(xsd); m !== null; m = re.exec(xsd)) index.add(m[1]!);
  return index;
}

export interface FidelityResult {
  offenders: Token[];
  checkedNames: number;
  checkedCerts: number;
}

/** Check the catalog against the vendored UCI sources under `refsDir`. */
export function findOffenders(refsDir: string = REFS_DIR): FidelityResult {
  const catalog = loadCatalog();
  const xsdNames = buildXsdNameIndex(readFileSync(resolve(refsDir, catalog.xsd), "utf8"));
  const specText = catalog.sources.map((s) => readFileSync(resolve(refsDir, s), "utf8")).join("\n");

  const tokens = collectTokens();
  const offenders = tokens.filter((t) =>
    t.kind === "name" ? !xsdNames.has(t.value) : !specText.includes(t.value),
  );

  const names = new Set(tokens.filter((t) => t.kind === "name").map((t) => t.value));
  const certs = new Set(tokens.filter((t) => t.kind === "cert").map((t) => t.value));
  return { offenders, checkedNames: names.size, checkedCerts: certs.size };
}
