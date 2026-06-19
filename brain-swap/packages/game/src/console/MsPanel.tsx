// TELEMETRY · MS → MA (left column, under the FA panel). Mission Systems runs in parallel
// with FA on the same bus; this panel distills the latest state of each MS subsystem
// (SubsystemStatusMT) and service (ServiceStatusMT) the heartbeat has published. Rendered
// only when the level has an MS body. Collapsible — and collapsed by default on short
// viewports, where the FA panel + map already compete for height.

import { useMemo, useState } from "react";
import { useStore } from "../store.ts";
import { Identifier } from "../ui/Identifier.tsx";
import { Panel } from "../ui/Panel.tsx";
import { latestByKey } from "./telemetry-utils.ts";

function shortViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-height: 860px)").matches;
}

const OK_STATES = new Set(["OPERATE", "NORMAL"]);
const BAD_STATES = new Set(["DEGRADED", "INOPERABLE"]);

function StatusRow({ id, state }: { id: string; state: string }) {
  return (
    <div className={`tele-row${OK_STATES.has(state) ? " good" : ""}`}>
      <span className="tk">{id}</span>
      <span className="tv">
        <Identifier name={state} enumStyle={BAD_STATES.has(state) ? "bad" : "enum"} />
      </span>
    </div>
  );
}

export function MsPanel() {
  const world = useStore((s) => s.world());
  const hasMs = useStore((s) => Boolean(s.level.msBody));
  const [collapsed, setCollapsed] = useState(() => shortViewport());

  const log = world.log;
  const { subs, svcs } = useMemo(
    () => ({
      subs: latestByKey(log, "SubsystemStatusMT", "SubsystemID"),
      svcs: latestByKey(log, "ServiceStatusMT", "ServiceID"),
    }),
    [log],
  );

  if (!hasMs) return null;

  return (
    <Panel
      title="TELEMETRY"
      titleAccent="MS → MA"
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
    >
      <div className="tele-grid">
        {subs.length === 0 && svcs.length === 0 && (
          <div className="tele-row">
            <span className="tk">Status</span>
            <span className="tv">awaiting heartbeat…</span>
          </div>
        )}
        {subs.map((s) => (
          <StatusRow
            key={String(s.SubsystemID)}
            id={String(s.SubsystemID)}
            state={String(s.SubsystemState)}
          />
        ))}
        {svcs.map((s) => (
          <StatusRow
            key={String(s.ServiceID)}
            id={String(s.ServiceID)}
            state={String(s.ServiceState)}
          />
        ))}
      </div>
    </Panel>
  );
}
