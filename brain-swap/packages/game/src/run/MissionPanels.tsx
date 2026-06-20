// MissionCard + BodySpecSheet (center column, under the map).

import { useEffect } from "react";
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
  const openTeaches = useStore((s) => s.openTeaches);
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
        ) : o.kind === "ms-status" ? (
          <div className="win">
            WIN ▸ confirm MS subsystem {o.subsystemId} is {o.requiredState} via an on-demand status
            request.
          </div>
        ) : o.kind === "ms-track" ? (
          <div className="win">
            WIN ▸ schedule the sensor and collect {o.requiredCount} tracks (EntityMT).
          </div>
        ) : o.kind === "ms-strike" ? (
          <div className="win">
            WIN ▸ complete the strike on task {o.taskId} — answer the consent request to release.
          </div>
        ) : o.kind === "route-complete" ? (
          <div className="win">
            WIN ▸ upload &amp; activate route {o.routeId}; FA flies it to COMPLETE, then hold the
            loiter for {o.holdTicks} ticks.
          </div>
        ) : o.kind === "curve-complete" ? (
          <div className="win">
            WIN ▸ command a valid curve to CURVE_COMPLETED, then hold the terminal for {o.holdTicks}{" "}
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
        {level.teaches && (
          <button
            type="button"
            className="btn sm"
            style={{ alignSelf: "flex-start", marginTop: 6 }}
            onClick={openTeaches}
            title="What this level teaches (pauses the clock)"
          >
            ⓘ Field notes
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Field-notes popup: the level's `teaches` copy. Modal (pauses the live clock via the store)
 *  so the player can read the lesson without the bus advancing under them. */
export function TeachesModal() {
  const open = useStore((s) => s.teachesOpen);
  const teaches = useStore((s) => s.level.teaches);
  const title = useStore((s) => s.level.title);
  const close = useStore((s) => s.closeTeaches);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !teaches) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop scrim; the Close button is the keyboard-accessible control
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop scrim; Escape closes and the Close button is the keyboard control
    <div className="modal-scrim" onClick={close}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops backdrop dismiss on inner clicks; not an interactive control */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop dismiss on inner clicks; not an interactive control */}
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <Panel title="FIELD" titleAccent="NOTES" meta={title?.toUpperCase()}>
          <div className="datalist" style={{ gap: 6 }}>
            <div className="obj" style={{ lineHeight: 1.5 }}>
              {teaches}
            </div>
          </div>
        </Panel>
        <div className="mfoot">
          <span className="vsum">Clock paused · Esc or Close to resume control</span>
          <div className="right">
            <button type="button" className="btn" onClick={close}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
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
