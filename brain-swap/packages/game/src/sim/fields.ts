// Build the inspector field rows for a logged message. FIDELITY (CLAUDE.md rule #1):
// rows come ONLY from the real catalog (`MESSAGE_CATALOG[type].fields`) intersected with
// what the pruned payload actually carries. The HTML mockup's invented nested tree
// (CannotComplyDetails.FailedFieldPath / CapabilityLimit / RequestedValue) is deliberately
// NOT reproduced — those names are not in the A-GRA XSD. Real payloads are flat, so the
// "tree" is a flat ordered list keyed by the catalog field metadata.
import { catalogEntry, isKnownMessageType, type MessageTypeName } from "@brain-swap/core";

export interface FieldRow {
  readonly name: string;
  readonly value: string;
  readonly present: boolean;
  readonly required: boolean;
  /** value styling: enum → amber, bad → caution (a failed validation result), value → plain. */
  readonly kind: "enum" | "bad" | "value";
  readonly note?: string;
}

function fmt(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

export function buildFieldRows(type: string, payload: unknown): FieldRow[] {
  if (!isKnownMessageType(type)) return [];
  const meta = catalogEntry(type as MessageTypeName);
  const p = (payload ?? {}) as Record<string, unknown>;
  const rows: FieldRow[] = [];
  for (const f of meta.fields) {
    const present = Object.prototype.hasOwnProperty.call(p, f.name);
    const raw = p[f.name];
    const isEnum = f.type === "enum";
    // The single "bad" highlight: a non-VALID ValidationResult on a rejected command.
    const isBadResult =
      type === "MA_FlightCommandStatusMT" &&
      f.name === "ValidationResult" &&
      present &&
      raw !== "FLIGHT_COMMAND_VALID";
    rows.push({
      name: f.name,
      value: present ? fmt(raw) : "—",
      present,
      required: f.required,
      kind: isBadResult ? "bad" : isEnum ? "enum" : "value",
    });
  }
  return rows;
}
