// Pure fidelity-check logic (docs/02-fidelity.md §5), shared by the CLI
// (check-fidelity.ts) and the vitest gate (fidelity.test.ts).
//
// Three token classes, three sources of truth:
//   • NAME tokens  — every message/type/field/enum name + enum literal in the
//     catalog — must appear as a name="…"/value="…" identifier in the UCI XSD.
//   • CERT tokens  — every CERT/RQMT number (UNIS-/USTD-/SCH-xxxxxx) inside any
//     `cite:` or a finding `code` — must appear verbatim in the UCI specs.
//   • QUOTE tokens — every validator finding's verbatim `quote` — must appear
//     (whitespace-normalized) in the source file it cites.
// Unknown names, numbers, or quotes fail the build. The game may omit; it may
// never rename, invent, or misquote.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CatalogComplexType } from "./catalog-source.ts";
import { loadCatalog, REFS_DIR } from "./catalog-source.ts";

export interface Token {
  value: string;
  kind: "name" | "cert" | "quote";
  owner: string;
}

/** Collapse all whitespace runs to single spaces so a quote matches across the
 *  line wrapping introduced by PDF/txt extraction. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

  for (const f of catalog.findings) {
    for (const c of f.code.match(CERT_RE) ?? [])
      tokens.push({ value: c, kind: "cert", owner: f.id });
    if (f.quote) tokens.push({ value: f.quote, kind: "quote", owner: `${f.id} (${f.source})` });
  }

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
  checkedQuotes: number;
}

/** Check the catalog against the vendored UCI sources under `refsDir`. */
export function findOffenders(refsDir: string = REFS_DIR): FidelityResult {
  const catalog = loadCatalog();
  const xsdText = readFileSync(resolve(refsDir, catalog.xsd), "utf8");
  const xsdNames = buildXsdNameIndex(xsdText);
  const specText = Object.values(catalog.sources)
    .map((s) => readFileSync(resolve(refsDir, s), "utf8"))
    .join("\n");

  // Normalized text per source key, so a quote matches across line wrapping.
  const normalizedSource = new Map<string, string>();
  const sourceText = (key: string): string => {
    let t = normalizedSource.get(key);
    if (t === undefined) {
      const file = key === "xsd" ? catalog.xsd : catalog.sources[key];
      t = normalizeWhitespace(readFileSync(resolve(refsDir, file ?? key), "utf8"));
      normalizedSource.set(key, t);
    }
    return t;
  };

  const tokens = collectTokens();
  const offenders: Token[] = [];
  for (const t of tokens) {
    if (t.kind === "name") {
      if (!xsdNames.has(t.value)) offenders.push(t);
    } else if (t.kind === "cert") {
      if (!specText.includes(t.value)) offenders.push(t);
    }
  }
  for (const f of catalog.findings) {
    if (!f.quote) continue;
    if (!sourceText(f.source).includes(normalizeWhitespace(f.quote))) {
      offenders.push({ value: f.quote, kind: "quote", owner: `${f.id} (${f.source})` });
    }
  }

  const distinct = (kind: Token["kind"]) =>
    new Set(tokens.filter((t) => t.kind === kind).map((t) => t.value)).size;
  return {
    offenders,
    checkedNames: distinct("name"),
    checkedCerts: distinct("cert"),
    checkedQuotes: distinct("quote"),
  };
}
