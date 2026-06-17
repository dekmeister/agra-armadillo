// TELEMETRY (left column, realtime). You are the MA brain, so you must watch FA's stream
// and decide when to act. Reading the scrolling Message Log tick-by-tick is hard, so this
// panel distills the LATEST value of each decision-relevant field FA has published, plus
// the live objective-hold progress. (Automated field-watches — auto-pause when a value
// matches — are deferred; see PLAN_FUTURE.md. For now you watch this panel by eye.)
import { useMemo } from "react";
import type { MessageLogEntry, MessageTypeName } from "@brain-swap/core";
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { Identifier } from "../ui/Identifier.tsx";

/** Latest payload of a given message type in the log up to the playhead, or undefined. */
function latest(log: readonly MessageLogEntry[], type: MessageTypeName): Record<string, unknown> | undefined {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]!.type === type) return log[i]!.payload as Record<string, unknown>;
  }
  return undefined;
}

function fmt(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

function Row({
  label,
  children,
  good,
}: {
  label: string;
  children: React.ReactNode;
  good?: boolean;
}) {
  return (
    <div className={`tele-row${good ? " good" : ""}`}>
      <span className="tk">{label}</span>
      <span className="tv">{children}</span>
    </div>
  );
}

export function TelemetryPanel() {
  const world = useStore((s) => s.world());
  const level = useStore((s) => s.level);
  const openComposer = useStore((s) => s.openComposer);
  const composing = useStore((s) => s.composing);
  const tutorial = useStore((s) => s.tutorial);

  const log = world.log;
  const t = useMemo(() => {
    const cap = latest(log, "MA_FlightCapabilityStatusMT");
    const ctrlReq = latest(log, "MA_ControlRequestStatusMT");
    const ctrl = latest(log, "ControlStatusMT");
    const cmd = latest(log, "MA_FlightCommandStatusMT");
    const act = latest(log, "MA_FlightActivityMT");
    const pos = latest(log, "MA_PositionReportDetailedMT");
    return { cap, ctrlReq, ctrl, cmd, act, pos };
  }, [log]);

  const isController = t.ctrl?.SecondaryController === "MA";
  const cmdState = t.cmd?.CommandProcessingState as string | undefined;
  const cmdGood = cmdState === "ACCEPTED";
  const cmdBad = cmdState === "REJECTED";

  const holdTarget = level.objective.kind === "reach-hold" || level.objective.kind === "hold-control"
    ? level.objective.holdTicks
    : undefined;

  return (
    <Panel title="TELEMETRY" titleAccent="FA → MA" meta="LATEST RECEIVED" className="grow">
      <div className="tele-fill">
        <div className="tele-grid">
          <Row label="Capability">
            {t.cap ? <Identifier name={fmt(t.cap.Availability)} enumStyle="enum" /> : "—"}
          </Row>
          <Row label="Control req">
            {t.ctrlReq ? (
              <Identifier name={fmt(t.ctrlReq.ApprovalRequestProcessingState)} enumStyle="enum" />
            ) : (
              "—"
            )}
          </Row>
          <Row label="Authority" good={isController}>
            {t.ctrl ? (isController ? "SECONDARY (you)" : fmt(t.ctrl.SecondaryController)) : "—"}
          </Row>
          <Row label="Last command" good={cmdGood}>
            {t.cmd ? (
              <Identifier name={fmt(cmdState)} enumStyle={cmdBad ? "bad" : "enum"} />
            ) : (
              "—"
            )}
          </Row>
          {cmdBad && t.cmd?.ValidationResult !== undefined && (
            <Row label="↳ reason">
              <Identifier name={fmt(t.cmd.ValidationResult)} enumStyle="bad" />
            </Row>
          )}
          <Row label="Activity">
            {t.act ? `alt ${fmt(t.act.Altitude)} · hdg ${fmt(t.act.Heading)} · spd ${fmt(t.act.Speed)}` : "—"}
          </Row>
          <Row label="Position">
            {t.pos ? `alt ${fmt(t.pos.Altitude)} · nav ${fmt(t.pos.NavigationSolutionState)}` : "—"}
          </Row>
          {holdTarget !== undefined && (
            <Row label="Objective hold" good={world.holdTicks >= holdTarget}>
              {world.holdTicks} / {holdTarget}
            </Row>
          )}
        </div>

        <div className="tele-foot">
          <button
            className="btn on big"
            data-tour="compose"
            onClick={openComposer}
            disabled={composing || tutorial}
          >
            ✎ Compose &amp; Send [C]
          </button>
          <div className="k-dim" style={{ fontSize: 9, marginTop: 6, lineHeight: 1.4 }}>
            {tutorial ? (
              <>
                This is a guided demo. Just press <b>▶ Play</b> and watch the mission solve itself —
                composing is disabled here.
              </>
            ) : (
              <>
                You are the MA brain. Watch FA above; press <b>Compose</b> (the clock pauses) to send a
                message. It reaches FA the next tick.
              </>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
