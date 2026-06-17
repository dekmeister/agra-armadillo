// MissionCard + BodySpecSheet (center column, under the map).

import { capEntries } from "../sim/caps.ts";
import { useStore } from "../store.ts";
import { Identifier } from "../ui/Identifier.tsx";
import { Panel } from "../ui/Panel.tsx";

interface CollapseProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function MissionCard({ collapsed, onToggleCollapse }: CollapseProps) {
  const level = useStore((s) => s.level);
  const o = level.objective;
  const avoidCount = level.avoid?.length ?? 0;
  return (
    <Panel
      title="MISSION"
      titleAccent="CARD"
      className="grow-0"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
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
                Fly to the objective zone at ({o.zone.x}, {o.zone.y}) m (radius {o.zone.radius} m)
                and hold at {o.altitude} m (±{o.altitudeTolerance} m).
              </div>
            )}
            <div className="win">
              WIN ▸ in-zone & at altitude for {o.holdTicks} consecutive ticks.
            </div>
          </>
        ) : o.kind === "hold-control" ? (
          <div className="win">
            WIN ▸ hold secondary control of {level.capabilityId} for {o.holdTicks} consecutive
            ticks.
          </div>
        ) : (
          <div className="win">
            WIN ▸ pass {o.waypoints.length} waypoints in order, then hold for {o.holdTicks} ticks.
          </div>
        )}
        {avoidCount > 0 && (
          <div className="win k-warn">
            CAUTION ▸ stay clear of {avoidCount} no-fly zone{avoidCount > 1 ? "s" : ""} — entering
            one ends the mission.
          </div>
        )}
      </div>
    </Panel>
  );
}

export function BodySpecSheet({ collapsed, onToggleCollapse }: CollapseProps) {
  const body = useStore((s) => s.body);
  const level = useStore((s) => s.level);
  const world = useStore((s) => s.world());
  const cap = body.capabilities.find((c) => c.id === level.capabilityId);
  const rows = capEntries(body, level.capabilityId);

  // Fuel gauge (fuel-bearing bodies only): live remaining fuel vs capacity.
  const fuelModel = body.fuel;
  const fuelNow = world.vehicle.fuel;
  const fuelPct =
    fuelModel && fuelNow !== undefined && fuelModel.capacity > 0
      ? Math.max(0, Math.min(100, (fuelNow / fuelModel.capacity) * 100))
      : null;

  return (
    <Panel
      title="BODY"
      titleAccent="SPEC SHEET"
      meta="MA_FlightCapabilityMT"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
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
        {fuelModel && fuelPct !== null && (
          <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="k">Fuel</span>
              <span className={`v${fuelPct <= 20 ? " k-caution" : ""}`}>
                {Math.round(fuelNow!)} / {fuelModel.capacity} kg · {Math.round(fuelPct)}%
              </span>
            </div>
            <div
              style={{ height: 4, background: "var(--k-line)", border: "1px solid var(--k-line2)" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${fuelPct}%`,
                  background: fuelPct <= 20 ? "var(--k-warn)" : "var(--k-green)",
                }}
              />
            </div>
          </div>
        )}
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
