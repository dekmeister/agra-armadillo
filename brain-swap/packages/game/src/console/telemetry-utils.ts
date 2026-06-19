// Shared telemetry-panel helpers. Both the FA TelemetryPanel and the MS MsPanel distill
// the latest value of each decision-relevant field from the live message log.

import type { MessageLogEntry, MessageTypeName } from "@brain-swap/core";

/** Latest payload of a given message type in the log up to the playhead, or undefined. */
export function latest(
  log: readonly MessageLogEntry[],
  type: MessageTypeName,
): Record<string, unknown> | undefined {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]!.type === type) return log[i]!.payload as Record<string, unknown>;
  }
  return undefined;
}

/** Latest payload per distinct value of `keyField` (e.g. the newest SubsystemStatusMT for
 *  each SubsystemID), in first-seen order. Used to show one row per MS subsystem/service. */
export function latestByKey(
  log: readonly MessageLogEntry[],
  type: MessageTypeName,
  keyField: string,
): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const e of log) {
    if (e.type !== type) continue;
    const p = e.payload as Record<string, unknown>;
    const k = String(p[keyField]);
    byKey.set(k, p);
  }
  return [...byKey.values()];
}

/** Format a telemetry value for display. */
export function fmt(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}
