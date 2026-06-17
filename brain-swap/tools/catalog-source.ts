// Shared loader for the Tier-1 message catalog (packages/levels/catalog/tier1.yaml).
// Used by gen-catalog.ts (codegen) and check-fidelity.ts (the CI gate). Keeping a
// single source of truth means the generated types and the fidelity check can never
// disagree about what the catalog contains.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export type FieldType = "string" | "number" | "boolean" | "enum" | "object";
export type Direction = "MA->FA" | "FA->MA";

export interface CatalogField {
  name: string;
  path: string;
  type: FieldType;
  values?: string[];
  required: boolean;
}

export interface CatalogMessage {
  name: string;
  tier: number;
  direction: Direction;
  citation: string;
  summary: string;
  fields: CatalogField[];
}

export interface Catalog {
  version: number;
  xsd: string;
  messages: CatalogMessage[];
}

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..");
export const CATALOG_PATH = resolve(REPO_ROOT, "packages/levels/catalog/tier1.yaml");

// Default XSD: the in-repo copy (guaranteed present, no external dependency).
// Byte-identical to the canonical ../References/A-GRA/standard/Schema/ copy.
export const DEFAULT_XSD_PATH = resolve(
  REPO_ROOT,
  "docs/A-GRA References/A-GRA_MessageDefinitions_v5_0_a.xsd",
);

const FIELD_TYPES: ReadonlySet<string> = new Set(["string", "number", "boolean", "enum", "object"]);

function fail(msg: string): never {
  throw new Error(`catalog: ${msg}`);
}

export function loadCatalog(path = CATALOG_PATH): Catalog {
  const raw = parse(readFileSync(path, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null) fail("root must be a mapping");
  const cat = raw as Record<string, unknown>;
  if (!Array.isArray(cat.messages)) fail("`messages` must be a list");

  const seen = new Set<string>();
  const messages: CatalogMessage[] = cat.messages.map((m, i) => {
    if (typeof m !== "object" || m === null) fail(`message[${i}] must be a mapping`);
    const msg = m as Record<string, unknown>;
    const name = msg.name;
    if (typeof name !== "string" || name.length === 0) fail(`message[${i}].name missing`);
    if (seen.has(name)) fail(`duplicate message name ${name}`);
    seen.add(name);
    if (!Array.isArray(msg.fields)) fail(`${name}.fields must be a list`);

    const fieldNames = new Set<string>();
    const fields: CatalogField[] = msg.fields.map((f, j) => {
      if (typeof f !== "object" || f === null) fail(`${name}.fields[${j}] must be a mapping`);
      const fld = f as Record<string, unknown>;
      const fname = fld.name;
      if (typeof fname !== "string") fail(`${name}.fields[${j}].name missing`);
      if (fieldNames.has(fname)) fail(`${name}: duplicate field ${fname}`);
      fieldNames.add(fname);
      const ftype = fld.type;
      if (typeof ftype !== "string" || !FIELD_TYPES.has(ftype)) {
        fail(`${name}.${fname}.type must be one of ${[...FIELD_TYPES].join("|")}`);
      }
      if (ftype === "enum" && (!Array.isArray(fld.values) || fld.values.length === 0)) {
        fail(`${name}.${fname} is enum but has no values`);
      }
      const values =
        fld.values === undefined
          ? undefined
          : (fld.values as unknown[]).map((v) => {
              if (typeof v !== "string") fail(`${name}.${fname} enum values must be strings`);
              return v;
            });
      return {
        name: fname,
        path: typeof fld.path === "string" ? fld.path : fname,
        type: ftype as FieldType,
        ...(values ? { values } : {}),
        required: fld.required === true,
      };
    });

    return {
      name,
      tier: typeof msg.tier === "number" ? msg.tier : 1,
      direction: msg.direction === "MA->FA" ? "MA->FA" : "FA->MA",
      citation: typeof msg.citation === "string" ? msg.citation : "",
      summary: typeof msg.summary === "string" ? msg.summary.trim() : "",
      fields,
    };
  });

  return {
    version: typeof cat.version === "number" ? cat.version : 1,
    xsd: typeof cat.xsd === "string" ? cat.xsd : "",
    messages,
  };
}
