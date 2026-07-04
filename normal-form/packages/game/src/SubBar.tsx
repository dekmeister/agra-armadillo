// Goal + metrics sub-bar (handoff § Component: Goal + metrics sub-bar): GOAL
// badge + hand-lettered goal line on the left; the three live metric pills and
// the RUN controls on the right. Metrics come from the engine (useRun), TICK from
// live playback state.
import { sheet_1_1 } from "@normal-form/levels";
import { useGameStore } from "./store.ts";
import { FONT, LAYOUT, RADIUS, STATUS, SURFACE, ZONE } from "./tokens.ts";
import { useRun } from "./useRun.ts";

function MetricPill({
  label,
  value,
  denom,
  capColor,
  valueColor,
}: {
  label: string;
  value: string;
  denom: number;
  capColor: string;
  valueColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        border: `1px solid ${capColor}`,
        borderRadius: RADIUS.pill,
        overflow: "hidden",
        fontFamily: FONT.mono,
      }}
    >
      <span
        style={{
          background: capColor,
          color: "#fff",
          fontSize: 9,
          fontWeight: 700,
          padding: "0 6px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "2px 7px",
          color: valueColor,
          display: "flex",
          alignItems: "center",
        }}
      >
        {value}
        <span style={{ opacity: 0.5 }}>/{denom}</span>
      </span>
    </div>
  );
}

export function SubBar() {
  const tick = useGameStore((s) => s.tick);
  const playing = useGameStore((s) => s.playing);
  const machine = useGameStore((s) => s.machine);
  const play = useGameStore((s) => s.play);
  const pause = useGameStore((s) => s.pause);
  const reset = useGameStore((s) => s.reset);
  const setTick = useGameStore((s) => s.setTick);
  const { score, endTick } = useRun();

  const pars = sheet_1_1.pars;
  const dash = "—";
  const canRun = machine !== null && endTick > 0;

  const onPlay = () => {
    if (playing) {
      pause();
      return;
    }
    if (tick >= endTick) reset();
    play();
  };
  const onStep = () => setTick(Math.min(tick + 1, endTick));

  return (
    <div
      style={{
        height: LAYOUT.subBarH,
        flex: `0 0 ${LAYOUT.subBarH}px`,
        background: SURFACE.chrome,
        borderBottom: `1.5px solid ${SURFACE.ink}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        gap: 12,
        fontFamily: FONT.mono,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          style={{
            background: SURFACE.ink,
            color: SURFACE.vellum,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".08em",
            padding: "3px 8px",
            borderRadius: RADIUS.chip,
          }}
        >
          GOAL
        </span>
        <span
          style={{
            fontFamily: FONT.hand,
            fontSize: 15,
            color: SURFACE.ink,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sheet_1_1.goal.text}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <MetricPill
          label="MSG"
          value={score ? String(score.messages) : dash}
          denom={pars.messages}
          capColor={STATUS.pass}
          valueColor={SURFACE.ink}
        />
        <MetricPill
          label="SIZE"
          value={score ? String(score.machineSize) : dash}
          denom={pars.machineSize}
          capColor={ZONE.sendRespond}
          valueColor={SURFACE.ink}
        />
        <MetricPill
          label="TICK"
          value={String(tick)}
          denom={pars.ticks}
          capColor={ZONE.accent}
          valueColor={playing ? ZONE.accent : SURFACE.ink}
        />

        <span style={{ width: 1, height: 24, background: "rgba(36,67,95,.3)" }} />

        <button
          type="button"
          onClick={onPlay}
          disabled={!canRun}
          style={{
            background: SURFACE.ink,
            color: SURFACE.vellum,
            padding: "6px 13px",
            borderRadius: RADIUS.pill,
            border: "none",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: FONT.mono,
            cursor: canRun ? "pointer" : "not-allowed",
            opacity: canRun ? 1 : 0.4,
          }}
        >
          {playing ? "❚❚ PAUSE" : "▶ PLAY"}
        </button>
        <button type="button" onClick={onStep} disabled={!canRun} style={outlineBtn(canRun)}>
          STEP
        </button>
        <button type="button" onClick={reset} disabled={!canRun} style={outlineBtn(canRun)}>
          RESET
        </button>
      </div>
    </div>
  );
}

function outlineBtn(enabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: SURFACE.ink,
    padding: "6px 11px",
    borderRadius: RADIUS.pill,
    border: `1.5px solid ${SURFACE.ink}`,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: FONT.mono,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.4,
  };
}
