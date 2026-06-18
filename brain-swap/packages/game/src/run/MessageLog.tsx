// The MESSAGE LOG pillar (right column) + the InspectorPanel that drops in at its bottom.
// This is the debugger (docs/04). Bound to the live bus: world.log up to the playhead.
// Non-collapsible by design — hiding the log defeats the game's premise (handoff).

import type { MessageLogEntry, MessageTypeName } from "@brain-swap/core";
import { useEffect, useMemo, useRef } from "react";
import { hintFor } from "../meta/hints.ts";
import { buildFieldRows } from "../sim/fields.ts";
import { useStore } from "../store.ts";
import { DispositionBadge } from "../ui/DispositionBadge.tsx";
import { Identifier } from "../ui/Identifier.tsx";
import { Panel } from "../ui/Panel.tsx";
import { badgeFor } from "../ui/tokens.ts";

// FA's timer-driven publications — see faPublish() in core/src/fa/engine.ts.
const PERIODIC_TYPES = new Set<MessageTypeName>([
  "MA_PositionReportDetailedMT",
  "MA_FlightActivityMT",
  "NavigationReportMT",
]);

export function MessageLogPanel() {
  const world = useStore((s) => s.world());
  const running = useStore((s) => s.running);
  const selected = useStore((s) => s.selectedLogIndex);
  const selectLog = useStore((s) => s.selectLog);
  const showPeriodic = useStore((s) => s.showPeriodic);
  const toggleShowPeriodic = useStore((s) => s.toggleShowPeriodic);

  const log = world.log;
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () =>
      log.map((e, i) => ({ e, i })).filter(({ e }) => showPeriodic || !PERIODIC_TYPES.has(e.type)),
    [log, showPeriodic],
  );
  const hiddenCount = log.length - visible.length;

  const selectedVisible =
    selected !== null &&
    log[selected] !== undefined &&
    (showPeriodic || !PERIODIC_TYPES.has(log[selected]!.type));

  // Auto-scroll to newest while running.
  // biome-ignore lint/correctness/useExhaustiveDependencies: log.length is a trigger dep, not read inside
  useEffect(() => {
    if (running && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [running, log.length]);

  return (
    <Panel title="MESSAGE" titleAccent="LOG" meta="BUS · MA ⇄ FA" className="grow">
      <div className="log-fill">
        <div className="log-controls">
          <button
            type="button"
            className="log-toggle"
            onClick={toggleShowPeriodic}
            title="Periodic FA publications: position + activity reports"
          >
            {showPeriodic ? "Hide" : "Show"} periodic
          </button>
          {!showPeriodic && hiddenCount > 0 && (
            <span className="log-hidden-count">{hiddenCount} hidden</span>
          )}
        </div>
        <div className="log-head">
          <span>TICK</span>
          <span>DIR</span>
          <span>TYPE · DISPOSITION</span>
        </div>
        <div className="log-rows-scroll" ref={scrollRef}>
          {visible.map(({ e, i }) => (
            <LogRow
              key={i}
              entry={e}
              selected={selected === i}
              onClick={() => selectLog(selected === i ? null : i)}
            />
          ))}
          {log.length === 0 && (
            <div style={{ padding: 12, fontSize: 10, color: "var(--k-dim)" }}>
              No traffic yet — press RUN to start the simulation.
            </div>
          )}
          {log.length > 0 && visible.length === 0 && (
            <div style={{ padding: 12, fontSize: 10, color: "var(--k-dim)" }}>
              All {log.length} messages are periodic and hidden.
            </div>
          )}
        </div>
        {selectedVisible && <Inspector entry={log[selected!]!} />}
      </div>
    </Panel>
  );
}

function LogRow({
  entry,
  selected,
  onClick,
}: {
  entry: MessageLogEntry;
  selected: boolean;
  onClick: () => void;
}) {
  const badge = badgeFor(entry.disposition, entry.type, entry.payload);
  const ma = entry.from === "MA";
  return (
    <button type="button" className={`logrow${selected ? " sel" : ""}`} onClick={onClick}>
      <span className="tick">{String(entry.tick).padStart(4, "0")}</span>
      <span className={`dir ${ma ? "ma" : "fa"}`}>{ma ? "MA→FA" : "FA→MA"}</span>
      <span className="typecell">
        <Identifier name={entry.type} />
        <DispositionBadge kind={badge.kind} reason={badge.reason} />
      </span>
    </button>
  );
}

function Inspector({ entry }: { entry: MessageLogEntry }) {
  const selectLog = useStore((s) => s.selectLog);
  const badge = useMemo(() => badgeFor(entry.disposition, entry.type, entry.payload), [entry]);
  const rows = useMemo(() => buildFieldRows(entry.type, entry.payload), [entry]);
  const hint = hintFor(badge.kind, badge.reason);

  return (
    <div className="inspector">
      <div className="ihead">
        <Identifier name={entry.type} />
        <button type="button" className="x" onClick={() => selectLog(null)} title="Close">
          ✕
        </button>
      </div>
      <div className="ibanner">
        <DispositionBadge kind={badge.kind} reason={badge.reason} />
        <span className="k-dim">
          {entry.from} → {entry.to} · tick {String(entry.tick).padStart(4, "0")}
        </span>
      </div>
      <div className="itree">
        {rows.length === 0 && <span className="k-dim">No catalogued fields.</span>}
        {rows.map((r) => (
          <div className="fieldrow" key={r.name}>
            <span className="fk">{r.name}:</span>
            {r.kind === "value" ? (
              <span className="fv">{r.value}</span>
            ) : (
              <Identifier name={r.value} enumStyle={r.kind} />
            )}
            {r.required && <span className="req">REQ</span>}
          </div>
        ))}
      </div>
      {hint && (
        <div className={`hint${hint.severity === "warn" ? " warn" : ""}`}>
          <span className="htitle">{hint.title}</span>
          {hint.body}
        </div>
      )}
    </div>
  );
}
