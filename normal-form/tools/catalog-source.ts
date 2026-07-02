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

export interface Catalog {
  version: number;
  xsd: string;
  sources: string[];
  enums: CatalogEnum[];
  envelope: CatalogComplexType[];
  messages: CatalogMessage[];
  types: CatalogComplexType[];
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

export function loadCatalog(path: string = CATALOG_PATH): Catalog {
  const raw = asRecord(parse(readFileSync(path, "utf8")), "root");

  const version = typeof raw.version === "number" ? raw.version : 1;
  const xsd = typeof raw.xsd === "string" ? raw.xsd : fail("`xsd` missing");
  if (!Array.isArray(raw.sources)) fail("`sources` must be a list");
  const sources = raw.sources.map((s, i) => {
    if (typeof s !== "string") fail(`sources[${i}] must be a string`);
    return s;
  });

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

  return { version, xsd, sources, enums, envelope, messages, types };
}
