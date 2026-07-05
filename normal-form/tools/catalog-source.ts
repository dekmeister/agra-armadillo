// Shared loader for the UCI message catalog (packages/levels/catalog/uci.yaml).
// Used by gen-catalog.ts (codegen) and check-fidelity.ts (the CI gate). One source
// of truth means the generated types and the fidelity check can never disagree
// about what the catalog contains.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export interface CatalogField {
  name: string;
  required: boolean;
  /** references an enum declared in `enums` (value is one of its literals) */
  enum?: string;
  /** references a complex type declared in `envelope` or `types` */
  ref?: string;
  cite?: string;
}

export interface CatalogEnum {
  name: string;
  values: string[];
  cite?: string;
}

/** A complex type (envelope member or shared base type) with a field list. */
export interface CatalogComplexType {
  name: string;
  cite?: string;
  fields: CatalogField[];
}

export interface CatalogMessage extends CatalogComplexType {
  /** the concrete message-type name, e.g. TaskCommandMT */
  mt: string;
  role: "request" | "response";
}

/** A validator finding: text lives in the catalog (policed), not code. */
export interface CatalogFinding {
  id: string;
  code: string;
  message: string;
  /** source key (`xsd` or a `sources` key) the quote is verified against, or
   *  `game-rule` for findings the standard does not back with a quote */
  source: string;
  docRef: string;
  quote?: string;
}

/** A verbatim quote in the reference codex, policed against `source` like a
 *  finding quote (WS-D). */
export interface CatalogReferenceQuote {
  id: string;
  source: string;
  cite: string;
  text: string;
}

/** One interaction-pattern block in the reference codex. Prose is unpoliced;
 *  `cite` CERT numbers and any `names` (concrete XSD identifiers) are policed. */
export interface CatalogReferencePattern {
  name: string;
  roles: string;
  naming: string;
  unlocksAt: string;
  summary: string;
  cite: string;
  /** concrete XSD element/field names this block asserts (grep-checked) */
  names: string[];
}

export interface CatalogReferenceDocument {
  key: string;
  title: string;
  owns: string;
}

export interface CatalogReferenceBridgeRow {
  primitive: string;
  brainSwap: string;
  serviceBus: string;
}

/** The curated prose layer of the in-game UCI REFERENCE screen (WS-D). Authored
 *  in the YAML so its CERT numbers, XSD names, and quotes run through the same
 *  fidelity gate as the mechanical catalog. */
export interface CatalogReference {
  overview: {
    blurb: string[];
    quote: CatalogReferenceQuote;
    documents: CatalogReferenceDocument[];
  };
  patterns: CatalogReferencePattern[];
  quotes: CatalogReferenceQuote[];
  bridge: CatalogReferenceBridgeRow[];
}

export interface Catalog {
  version: number;
  xsd: string;
  /** key → filename (key `xsd` is reserved for the schema) */
  sources: Record<string, string>;
  enums: CatalogEnum[];
  envelope: CatalogComplexType[];
  messages: CatalogMessage[];
  types: CatalogComplexType[];
  findings: CatalogFinding[];
  reference: CatalogReference;
}

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..");
export const CATALOG_PATH = resolve(REPO_ROOT, "packages/levels/catalog/uci.yaml");

// The vendored, committed, CI-safe copy of the UCI sources. Byte-identical to the
// git-ignored docs/References/ originals (see docs/02-fidelity.md, README).
export const REFS_DIR = resolve(REPO_ROOT, "docs/UCI References");

function fail(msg: string): never {
  throw new Error(`catalog: ${msg}`);
}

function asRecord(v: unknown, ctx: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${ctx} must be a mapping`);
  return v as Record<string, unknown>;
}

function parseField(raw: unknown, ctx: string, seen: Set<string>): CatalogField {
  const f = asRecord(raw, ctx);
  const name = f.name;
  if (typeof name !== "string" || name.length === 0) fail(`${ctx}.name missing`);
  if (seen.has(name)) fail(`${ctx}: duplicate field ${name}`);
  seen.add(name);
  if (f.enum !== undefined && typeof f.enum !== "string")
    fail(`${ctx}.${name}.enum must be a string`);
  if (f.ref !== undefined && typeof f.ref !== "string") fail(`${ctx}.${name}.ref must be a string`);
  return {
    name,
    required: f.required === true,
    ...(typeof f.enum === "string" ? { enum: f.enum } : {}),
    ...(typeof f.ref === "string" ? { ref: f.ref } : {}),
    ...(typeof f.cite === "string" ? { cite: f.cite } : {}),
  };
}

function parseComplexType(raw: unknown, i: number, names: Set<string>): CatalogComplexType {
  const t = asRecord(raw, `type[${i}]`);
  const name = t.name;
  if (typeof name !== "string" || name.length === 0) fail(`type[${i}].name missing`);
  if (names.has(name)) fail(`duplicate type name ${name}`);
  names.add(name);
  if (!Array.isArray(t.fields)) fail(`${name}.fields must be a list`);
  const seen = new Set<string>();
  const fields = t.fields.map((f, j) => parseField(f, `${name}.fields[${j}]`, seen));
  return { name, ...(typeof t.cite === "string" ? { cite: t.cite } : {}), fields };
}

/** Parse the curated `reference:` codex (WS-D). Validates that every quote-bearing
 *  entry names a real source key (like findings), so the fidelity gate can then
 *  police its CERT numbers, XSD names, and verbatim quotes. */
function parseReference(raw: unknown, sources: Record<string, string>): CatalogReference {
  const r = asRecord(raw, "`reference`");

  const strAt = (rec: Record<string, unknown>, ctx: string, k: string): string => {
    const v = rec[k];
    if (typeof v !== "string" || v.length === 0) fail(`${ctx}.${k} missing`);
    return v;
  };

  const parseQuote = (rawQ: unknown, ctx: string): CatalogReferenceQuote => {
    const q = asRecord(rawQ, ctx);
    const source = strAt(q, ctx, "source");
    if (source !== "xsd" && !(source in sources)) fail(`${ctx}: unknown source "${source}"`);
    return {
      id: strAt(q, ctx, "id"),
      source,
      cite: strAt(q, ctx, "cite"),
      text: strAt(q, ctx, "text"),
    };
  };

  const overviewRaw = asRecord(r.overview, "reference.overview");
  const blurb = (
    Array.isArray(overviewRaw.blurb)
      ? overviewRaw.blurb
      : fail("reference.overview.blurb must be a list")
  ).map((b, i) => {
    if (typeof b !== "string" || b.length === 0)
      fail(`reference.overview.blurb[${i}] must be a string`);
    return b;
  });
  // The overview self-description quote carries no `id`; give it a stable one.
  const overviewQuoteRaw = asRecord(overviewRaw.quote, "reference.overview.quote");
  const overviewQuote = parseQuote(
    { id: "overview", ...overviewQuoteRaw },
    "reference.overview.quote",
  );
  const documents = (
    Array.isArray(overviewRaw.documents)
      ? overviewRaw.documents
      : fail("reference.overview.documents must be a list")
  ).map((d, i) => {
    const ctx = `reference.overview.documents[${i}]`;
    const rec = asRecord(d, ctx);
    return {
      key: strAt(rec, ctx, "key"),
      title: strAt(rec, ctx, "title"),
      owns: strAt(rec, ctx, "owns"),
    };
  });

  const patternNames = new Set<string>();
  const patterns = (
    Array.isArray(r.patterns) ? r.patterns : fail("reference.patterns must be a list")
  ).map((p, i) => {
    const ctx = `reference.patterns[${i}]`;
    const rec = asRecord(p, ctx);
    const name = strAt(rec, ctx, "name");
    if (patternNames.has(name)) fail(`${ctx}: duplicate pattern ${name}`);
    patternNames.add(name);
    const names = rec.names === undefined ? [] : rec.names;
    if (!Array.isArray(names)) fail(`${ctx}.names must be a list`);
    return {
      name,
      roles: strAt(rec, ctx, "roles"),
      naming: strAt(rec, ctx, "naming"),
      unlocksAt: strAt(rec, ctx, "unlocksAt"),
      summary: strAt(rec, ctx, "summary"),
      cite: strAt(rec, ctx, "cite"),
      names: names.map((n, j) => {
        if (typeof n !== "string" || n.length === 0) fail(`${ctx}.names[${j}] must be a string`);
        return n;
      }),
    };
  });

  const quoteIds = new Set<string>();
  const quotes = (Array.isArray(r.quotes) ? r.quotes : fail("reference.quotes must be a list")).map(
    (q, i) => {
      const parsed = parseQuote(q, `reference.quotes[${i}]`);
      if (quoteIds.has(parsed.id)) fail(`reference.quotes: duplicate id ${parsed.id}`);
      quoteIds.add(parsed.id);
      return parsed;
    },
  );

  const bridge = (Array.isArray(r.bridge) ? r.bridge : fail("reference.bridge must be a list")).map(
    (b, i) => {
      const ctx = `reference.bridge[${i}]`;
      const rec = asRecord(b, ctx);
      return {
        primitive: strAt(rec, ctx, "primitive"),
        brainSwap: strAt(rec, ctx, "brainSwap"),
        serviceBus: strAt(rec, ctx, "serviceBus"),
      };
    },
  );

  return { overview: { blurb, quote: overviewQuote, documents }, patterns, quotes, bridge };
}

export function loadCatalog(path: string = CATALOG_PATH): Catalog {
  const raw = asRecord(parse(readFileSync(path, "utf8")), "root");

  const version = typeof raw.version === "number" ? raw.version : 1;
  const xsd = typeof raw.xsd === "string" ? raw.xsd : fail("`xsd` missing");
  const sourcesRaw = asRecord(raw.sources, "`sources`");
  const sources: Record<string, string> = {};
  for (const [key, val] of Object.entries(sourcesRaw)) {
    if (typeof val !== "string") fail(`sources.${key} must be a string`);
    sources[key] = val;
  }

  const typeNames = new Set<string>();
  const enumNames = new Set<string>();

  const enums: CatalogEnum[] = (
    Array.isArray(raw.enums) ? raw.enums : fail("`enums` must be a list")
  ).map((e, i) => {
    const en = asRecord(e, `enums[${i}]`);
    const name = en.name;
    if (typeof name !== "string") fail(`enums[${i}].name missing`);
    if (enumNames.has(name)) fail(`duplicate enum ${name}`);
    enumNames.add(name);
    if (!Array.isArray(en.values) || en.values.length === 0) fail(`${name} has no values`);
    const values = en.values.map((v) => {
      if (typeof v !== "string") fail(`${name} enum values must be strings`);
      return v;
    });
    return { name, values, ...(typeof en.cite === "string" ? { cite: en.cite } : {}) };
  });

  const parseList = (key: string): CatalogComplexType[] =>
    (Array.isArray(raw[key]) ? (raw[key] as unknown[]) : fail(`\`${key}\` must be a list`)).map(
      (t, i) => parseComplexType(t, i, typeNames),
    );

  const envelope = parseList("envelope");
  const types = parseList("types");

  const messages: CatalogMessage[] = (
    Array.isArray(raw.messages) ? raw.messages : fail("`messages` must be a list")
  ).map((m, i) => {
    const base = parseComplexType(m, i, typeNames);
    const rec = asRecord(m, `messages[${i}]`);
    const mt = rec.mt;
    if (typeof mt !== "string") fail(`${base.name}.mt missing`);
    if (typeNames.has(mt)) fail(`duplicate type name ${mt}`);
    typeNames.add(mt);
    if (rec.role !== "request" && rec.role !== "response")
      fail(`${base.name}.role must be request|response`);
    return { ...base, mt, role: rec.role };
  });

  const findingIds = new Set<string>();
  const findings: CatalogFinding[] = (
    Array.isArray(raw.findings) ? raw.findings : fail("`findings` must be a list")
  ).map((f, i) => {
    const rec = asRecord(f, `findings[${i}]`);
    const str = (k: string): string => {
      const v = rec[k];
      if (typeof v !== "string" || v.length === 0) fail(`findings[${i}].${k} missing`);
      return v;
    };
    const id = str("id");
    if (findingIds.has(id)) fail(`duplicate finding id ${id}`);
    findingIds.add(id);
    const source = str("source");
    if (source !== "game-rule" && source !== "xsd" && !(source in sources)) {
      fail(`finding ${id}: unknown source "${source}"`);
    }
    if (rec.quote !== undefined && typeof rec.quote !== "string")
      fail(`${id}.quote must be a string`);
    if (source !== "game-rule" && typeof rec.quote !== "string") {
      fail(`finding ${id}: a non game-rule finding must carry a verbatim quote`);
    }
    return {
      id,
      code: str("code"),
      message: str("message"),
      source,
      docRef: str("docRef"),
      ...(typeof rec.quote === "string" ? { quote: rec.quote } : {}),
    };
  });

  const reference = parseReference(raw.reference, sources);

  return { version, xsd, sources, enums, envelope, messages, types, findings, reference };
}
