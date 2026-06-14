// Pure fidelity-check logic (CLAUDE.md hard rule #1), shared by the CLI
// (check-fidelity.ts) and the vitest gate (fidelity.test.ts).
import { readFileSync } from "node:fs";
import { loadCatalog } from "./catalog-source.ts";

export interface Token {
  value: string;
  kind: "message" | "field" | "enum";
  owner: string; // "Message" or "Message.field" — for the offender report
}

/** Every catalog name that must exist in the XSD: message types, field names, enum literals. */
export function collectTokens(): Token[] {
  const catalog = loadCatalog();
  const tokens: Token[] = [];
  for (const msg of catalog.messages) {
    tokens.push({ value: msg.name, kind: "message", owner: msg.name });
    for (const field of msg.fields) {
      tokens.push({ value: field.name, kind: "field", owner: `${msg.name}.${field.name}` });
      for (const literal of field.values ?? []) {
        tokens.push({ value: literal, kind: "enum", owner: `${msg.name}.${field.name}` });
      }
    }
  }
  return tokens;
}

/**
 * Index of quoted XSD `name="…"` / `value="…"` identifiers. Matching the quoted
 * form (not raw substrings) avoids false positives from unrelated identifiers.
 */
export function buildXsdNameIndex(xsd: string): Set<string> {
  const index = new Set<string>();
  const re = /(?:name|value)="([A-Za-z0-9_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xsd)) !== null) index.add(m[1]!);
  return index;
}

export function findOffenders(xsdPath: string): { offenders: Token[]; checked: number } {
  const xsdNames = buildXsdNameIndex(readFileSync(xsdPath, "utf8"));
  const tokens = collectTokens();
  const offenders = tokens.filter((t) => !xsdNames.has(t.value));
  const checked = new Set(tokens.map((t) => `${t.kind}:${t.value}`)).size;
  return { offenders, checked };
}
