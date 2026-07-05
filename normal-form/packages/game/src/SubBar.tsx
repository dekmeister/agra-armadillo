// Goal + run-controls sub-bar (handoff § Component: Goal sub-bar): GOAL badge +
// hand-lettered goal line on the left; the RUN controls on the right. Scoring was
// cut at the MVP review (WS-B), so the three metric pills are gone — certification
// is pass/fail.
import { useGameStore } from "./store.ts";
import { FONT, LAYOUT, RADIUS, SURFACE } from "./tokens.ts";
import { useRun } from "./useRun.ts";

export function SubBar() {
  const sheet = useGameStore((s) => s.sheet);
  const tick = useGameStore((s) => s.tick);
  const playing = useGameStore((s) => s.playing);
  const play = useGameStore((s) => s.play);
  const pause = useGameStore((s) => s.pause);
  const reset = useGameStore((s) => s.reset);
  const setTick = useGameStore((s) => s.setTick);
  const runAll = useGameStore((s) => s.runAll);
  const { endTick, ready } = useRun();

  // RUN is unblocked only when the composition validates clean (S3 gate).
  const canRun = ready && endTick > 0;

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
          {sheet.goal.text}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={runAll}
          disabled={!ready}
          style={outlineBtn(ready)}
          title="run every seed headless and light the seed strip"
        >
          ⧉ RUN ALL
        </button>

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
