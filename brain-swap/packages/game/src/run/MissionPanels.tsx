// MissionCard + BodySpecSheet (center column, under the map).
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { Identifier } from "../ui/Identifier.tsx";
import { capEntries } from "../sim/caps.ts";

export function MissionCard() {
  const level = useStore((s) => s.level);
  const o = level.objective;
  return (
    <Panel title="MISSION" titleAccent="CARD" className="grow-0">
      <div className="datalist">
        {level.brief && (
          <div className="obj">
            <span className="k-dim">OBJECTIVE — </span>
            {level.brief}
          </div>
        )}
        {o.kind === "reach-hold" ? (
          <>
            {!level.brief && (
              <div className="obj">
                <span className="k-dim">OBJECTIVE — </span>
                Fly to the objective zone at ({o.zone.x}, {o.zone.y}) m (radius {o.zone.radius} m) and
                hold at {o.altitude} m (±{o.altitudeTolerance} m).
              </div>
            )}
            <div className="win">
              WIN ▸ in-zone & at altitude for {o.holdTicks} consecutive ticks.
            </div>
          </>
        ) : o.kind === "hold-control" ? (
          <div className="win">
            WIN ▸ hold secondary control of {level.capabilityId} for {o.holdTicks} consecutive ticks.
          </div>
        ) : (
          <div className="win">
            WIN ▸ pass {o.waypoints.length} waypoints in order, then hold for {o.holdTicks} ticks.
          </div>
        )}
      </div>
    </Panel>
  );
}

export function BodySpecSheet() {
  const body = useStore((s) => s.body);
  const level = useStore((s) => s.level);
  const cap = body.capabilities.find((c) => c.id === level.capabilityId);
  const rows = capEntries(body, level.capabilityId);

  return (
    <Panel title="BODY" titleAccent="SPEC SHEET" meta="MA_FlightCapabilityMT">
      <div className="datalist">
        <div className="row">
          <span className="k">ControlAuthority</span>
          <span className="v k-cyan">{cap?.type ?? "—"}</span>
        </div>
        {rows.map((r) => {
          // MaxAltitude is the binding constraint this level — shown in caution.
          const alert = r.key === "MaxAltitude";
          return (
            <div className="row" key={r.key}>
              <span className="k">{r.key}</span>
              <span className={`v${alert ? " k-caution" : ""}`}>{r.value}</span>
            </div>
          );
        })}
        <div className="row">
          <span className="k">MaxTurnRateDeg</span>
          <span className="v">{body.flight.maxTurnRateDeg}</span>
        </div>
        <div className="row">
          <span className="k">MaxClimbRate</span>
          <span className="v">{body.flight.maxClimbRate}</span>
        </div>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="k k-dim" style={{ fontSize: 9 }}>
            advertised via <Identifier name="MA_FlightCapabilityMT" /> — the same envelope FA
            validates against
          </span>
        </div>
      </div>
    </Panel>
  );
}
