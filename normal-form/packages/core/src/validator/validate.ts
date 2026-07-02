// The static validator — the compose gate (05-mvp battery V1–V10). Pure:
// validate(sheet, composition) → Finding[]. Every finding's text comes from the
// policed catalog (FINDINGS), so the console quotes the standard verbatim and the
// fidelity CI guarantees those quotes are real. Order = V1…V10.
import type { Sheet } from "../level/types.ts";
import { ruleFor } from "../machine/schema.ts";
import { FINDINGS, type FindingId, MESSAGE_CATALOG } from "../messages/index.ts";
import { isTerminalState } from "../types.ts";
import type { Composition, Finding } from "./types.ts";
import { classifyUuid } from "./uuid.ts";

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SCHEMA_VERSION = /^\d{3}\.\d{1,2}(\.\d{1,2})?([a-z]{1,2})?$/;

const modeValues = MESSAGE_CATALOG.enums.MessageModeEnum.values as readonly string[];
const commandStates = MESSAGE_CATALOG.enums.CommandStateEnum.values as readonly string[];

function makeFinding(id: FindingId, field?: string): Finding {
  const f = FINDINGS[id];
  const quote = (f as { quote?: string }).quote;
  return {
    id,
    code: f.code,
    message: f.message,
    docRef: f.docRef,
    ...(quote !== undefined ? { quote } : {}),
    ...(field !== undefined ? { field } : {}),
  };
}

const present = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

export function validate(sheet: Sheet, c: Composition): Finding[] {
  const findings: Finding[] = [];
  const f = c.fields;

  // V1 — SystemID present (required in uci:HeaderType).
  if (!present(f.SystemID)) findings.push(makeFinding("V1-systemid", "SystemID"));

  // V2 — Timestamp present + ISO-8601 (DateTimeType).
  if (!present(f.Timestamp) || !ISO_8601.test(f.Timestamp)) {
    findings.push(makeFinding("V2-timestamp", "Timestamp"));
  }

  // V3 — SchemaVersion present + well-formed schema-version string.
  if (!present(f.SchemaVersion) || !SCHEMA_VERSION.test(f.SchemaVersion)) {
    findings.push(makeFinding("V3-schemaversion", "SchemaVersion"));
  }

  // V4 — Mode ∈ MessageModeEnum, then matches the sheet's declared mode (game rule).
  if (!present(f.Mode) || !modeValues.includes(f.Mode)) {
    findings.push(makeFinding("V4-mode-enum", "Mode"));
  } else {
    const declared = sheet.compose.initialFields.Mode;
    if (present(declared) && f.Mode !== declared)
      findings.push(makeFinding("V4-mode-mismatch", "Mode"));
  }

  // V5/V6 — CommandID is a valid Leach-Salz/nil UUID (V5) in canonical form (V6).
  const verdict = classifyUuid(f.CommandID);
  if (verdict === "invalid") findings.push(makeFinding("V5-uuid-invalid", "CommandID"));
  else if (verdict === "noncanonical")
    findings.push(makeFinding("V6-uuid-noncanonical", "CommandID"));

  // V7 — CommandState ∈ CommandStateEnum.
  if (!present(f.CommandState) || !commandStates.includes(f.CommandState)) {
    findings.push(makeFinding("V7-commandstate", "CommandState"));
  }

  // V8 — request/response suffixes match the Command-2 pattern (CERT SCH-002461).
  const { request, response } = c.binding;
  const bindingOk =
    request.endsWith("Command") &&
    !request.endsWith("CommandStatus") &&
    response === `${request}Status`;
  if (!bindingOk) findings.push(makeFinding("V8-binding"));

  // V9 — both Command-2 roles bound to lifelines (CERT UNIS-000105).
  if (!present(c.roles.commander) || !present(c.roles.commandee))
    findings.push(makeFinding("V9-roles"));

  // V10 — a handler is wired for every reachable terminal state (READY gate).
  const reachableTerminals = sheet.requestee.onCommand
    .map((r) => r.report)
    .filter((s) => isTerminalState(s));
  const hasTerminalHandler = reachableTerminals.every(
    (state) =>
      c.machine !== undefined && c.machine.states.some((st) => ruleFor(c.machine!, st, state)),
  );
  if (!hasTerminalHandler) findings.push(makeFinding("V10-terminal-handler"));

  return findings;
}

/** True when the composition is clean and RUN is unblocked. */
export function isReady(sheet: Sheet, c: Composition): boolean {
  return validate(sheet, c).length === 0;
}
