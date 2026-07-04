// The SVG sequence-diagram board (handoff § Component: Board) — the hero. A
// vertical time axis (t0…tN), two lifelines at 36% / 74%, and message arrows
// colored by state enum. In RUN the arrows reveal as the tick advances, driven by
// the engine's frames; in COMPOSE/HANDLERS the board is a static shell of the
// sheet's initial state (editing is S5).
import { useLayoutEffect, useRef, useState } from "react";
import type { ArrowFrame } from "./frames.ts";
import type { Phase } from "./store.ts";
import { useGameStore } from "./store.ts";
import { ENUM_COLOR, FONT, LAYOUT, SURFACE, ZONE } from "./tokens.ts";
import { useRun } from "./useRun.ts";

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const GRID_BG =
  "repeating-linear-gradient(0deg, transparent 0 31px, rgba(36,67,95,.05) 31px 32px)," +
  "repeating-linear-gradient(90deg, transparent 0 31px, rgba(36,67,95,.05) 31px 32px)";

export function Board() {
  const [ref, { w, h }] = useSize();
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const seedId = useGameStore((s) => s.seedId);
  const machine = useGameStore((s) => s.machine);
  const { board } = useRun();

  const xLeft = w * (LAYOUT.lifelineLeftPct / 100);
  const xRight = w * (LAYOUT.lifelineRightPct / 100);
  const yTop = 78;
  const yBottom = Math.max(yTop + 40, h - 26);
  const rulerMax = Math.max(6, board?.endTick ?? 0);
  const yOf = (t: number) => yTop + (t / rulerMax) * (yBottom - yTop);

  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        position: "relative",
        background: SURFACE.board,
        backgroundImage: GRID_BG,
        overflow: "hidden",
      }}
    >
      {/* zone label */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontFamily: FONT.mono,
          zIndex: 2,
        }}
      >
        <span style={{ width: 9, height: 9, background: SURFACE.ink }} />
        <span style={{ fontSize: 12, fontWeight: 800 }}>DIAGRAM</span>
        <span style={{ fontFamily: FONT.hand, fontSize: 12, color: "rgba(36,67,95,.55)" }}>
          sequence · Commander ⇄ Commandee
        </span>
      </div>

      {w > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0 }}
          role="img"
          aria-label="sequence diagram"
        >
          <title>Sequence diagram — Commander to Commandee</title>

          {/* time ruler */}
          {Array.from({ length: rulerMax + 1 }, (_, i) => i).map((t) => (
            <text
              key={`ruler-${t}`}
              x={14}
              y={yOf(t) + 3}
              fontFamily={FONT.mono}
              fontSize={10}
              fontWeight={700}
              fill="rgba(36,67,95,.5)"
              textAnchor="middle"
            >
              t{t}
            </text>
          ))}

          {/* lifelines */}
          <LifelineHeader x={xLeft} label="Commander" tag="(you)" tagColor={ZONE.accent} />
          <LifelineHeader
            x={xRight}
            label="Commandee"
            tag="(SystemB)"
            tagColor="rgba(36,67,95,.6)"
          />
          <line
            x1={xLeft}
            y1={54}
            x2={xLeft}
            y2={yBottom + 12}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <line
            x1={xRight}
            y1={54}
            x2={xRight}
            y2={yBottom + 12}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />

          {/* arrows */}
          {phase === "run"
            ? board?.arrows
                .filter((a) => a.tick <= tick)
                .map((a) => (
                  <Arrow key={a.key} frame={a} xLeft={xLeft} xRight={xRight} y={yOf(a.tick)} />
                ))
            : renderShellArrows(phase, xLeft, xRight, yOf)}

          {/* activity mark on SystemB lifeline */}
          {phase === "run" && board?.activityTick != null && tick >= board.activityTick && (
            <g>
              <circle cx={xRight} cy={yOf(board.activityTick)} r={5} fill={ZONE.sendRespond} />
              <text
                x={xRight + 12}
                y={yOf(board.activityTick) + 4}
                fontFamily={FONT.mono}
                fontSize={10}
                fontWeight={700}
                fill={ZONE.sendRespond}
              >
                activity ✔
              </text>
            </g>
          )}

          {/* stamps */}
          {phase === "compose" && <RejectStamp w={w} />}
          {phase === "run" &&
            board?.goalTick != null &&
            tick >= board.goalTick &&
            board.fault === null && <GoalStamp w={w} h={h} seedId={seedId} />}
          {phase === "run" && board?.fault != null && tick >= board.fault.tick && (
            <FaultStamp w={w} y={yOf(board.fault.tick)} />
          )}
        </svg>
      )}

      {/* handler widget (HTML overlay) */}
      {phase === "handlers" && <HandlerWidget xLeft={xLeft} machine={machine} />}
    </div>
  );
}

function LifelineHeader({
  x,
  label,
  tag,
  tagColor,
}: {
  x: number;
  label: string;
  tag: string;
  tagColor: string;
}) {
  const boxW = 168;
  return (
    <g>
      <rect
        x={x - boxW / 2}
        y={10}
        width={boxW}
        height={30}
        fill={SURFACE.chrome}
        stroke={SURFACE.ink}
        strokeWidth={2}
      />
      <text
        x={x}
        y={30}
        fontFamily={FONT.mono}
        fontSize={13}
        fontWeight={800}
        fill={SURFACE.ink}
        textAnchor="middle"
      >
        {label} <tspan fill={tagColor}>{tag}</tspan>
      </text>
    </g>
  );
}

function Arrow({
  frame,
  xLeft,
  xRight,
  y,
}: {
  frame: ArrowFrame;
  xLeft: number;
  xRight: number;
  y: number;
}) {
  const isRequest = frame.dir === "request";
  const opacity = frame.muted ? 0.45 : 1;
  const headX = isRequest ? xRight : xLeft;
  const glyph = isRequest ? "▶" : "◀";
  return (
    <g opacity={opacity}>
      <line
        x1={xLeft}
        y1={y}
        x2={xRight}
        y2={y}
        stroke={frame.color}
        strokeWidth={frame.check ? 3 : 2.5}
        strokeDasharray={frame.dashed ? "6 5" : undefined}
      />
      <text
        x={headX}
        y={y + 4}
        fontFamily={FONT.mono}
        fontSize={12}
        fontWeight={800}
        fill={frame.color}
        textAnchor="middle"
      >
        {glyph}
      </text>
      <text
        x={(xLeft + xRight) / 2}
        y={y - 6}
        fontFamily={FONT.mono}
        fontSize={11}
        fontWeight={700}
        fill={frame.color}
        textAnchor="middle"
      >
        {frame.label}
      </text>
    </g>
  );
}

/** Static arrows for the COMPOSE / HANDLERS shells (no engine run). */
function renderShellArrows(
  phase: Phase,
  xLeft: number,
  xRight: number,
  yOf: (t: number) => number,
) {
  const req = (
    <Arrow
      key="shell-req"
      frame={{ key: "req", dir: "request", tick: 1, label: "TaskCommand →", color: ZONE.oneWay }}
      xLeft={xLeft}
      xRight={xRight}
      y={yOf(1)}
    />
  );
  if (phase === "compose") {
    return (
      <>
        {/* amber SEL selection box around the request */}
        <rect
          x={xLeft - 6}
          y={yOf(1) - 24}
          width={xRight - xLeft + 12}
          height={34}
          fill="rgba(192,125,31,.06)"
          stroke={ZONE.accent}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={xLeft - 10}
          y={yOf(1) - 12}
          fontFamily={FONT.mono}
          fontSize={9}
          fontWeight={800}
          fill={ZONE.accent}
          textAnchor="end"
        >
          ◄ SEL
        </text>
        {req}
        <Arrow
          key="shell-res"
          frame={{
            key: "res",
            dir: "response",
            tick: 3,
            label: "← TaskCommandStatus ⟨unset⟩",
            color: "rgba(36,67,95,.5)",
            dashed: true,
            muted: true,
          }}
          xLeft={xLeft}
          xRight={xRight}
          y={yOf(3)}
        />
      </>
    );
  }
  // handlers: request + a generic response arrow
  return (
    <>
      {req}
      <Arrow
        key="shell-res"
        frame={{
          key: "res",
          dir: "response",
          tick: 3,
          label: "← TaskCommandStatus",
          color: ENUM_COLOR.ACCEPTED,
          state: "ACCEPTED",
        }}
        xLeft={xLeft}
        xRight={xRight}
        y={yOf(3)}
      />
    </>
  );
}

function RejectStamp({ w }: { w: number }) {
  return (
    <g transform={`translate(${w - 210}, 92) rotate(-9)`}>
      <rect width={188} height={34} fill="rgba(178,58,46,.08)" stroke="#b23a2e" strokeWidth={3} />
      <text
        x={94}
        y={23}
        fontFamily={FONT.mono}
        fontSize={15}
        fontWeight={800}
        fill="#b23a2e"
        textAnchor="middle"
        letterSpacing="0.05em"
      >
        ✖ REJECTED · 2 ERR
      </text>
    </g>
  );
}

function GoalStamp({ w, h, seedId }: { w: number; h: number; seedId: number }) {
  return (
    <g transform={`translate(${w / 2 - 150}, ${h - 96}) rotate(-6)`}>
      <rect width={300} height={40} fill="rgba(47,143,91,.08)" stroke="#2f8f5b" strokeWidth={3} />
      <text
        x={150}
        y={26}
        fontFamily={FONT.mono}
        fontSize={15}
        fontWeight={800}
        fill="#2f8f5b"
        textAnchor="middle"
      >
        ✔ GOAL REACHED · seed {["①", "②", "③"][seedId - 1] ?? seedId} pass
      </text>
    </g>
  );
}

function FaultStamp({ w, y }: { w: number; y: number }) {
  return (
    <g transform={`translate(${w - 230}, ${y - 20}) rotate(-6)`}>
      <rect width={210} height={30} fill="rgba(192,57,43,.1)" stroke="#c0392b" strokeWidth={3} />
      <text
        x={105}
        y={20}
        fontFamily={FONT.mono}
        fontSize={12}
        fontWeight={800}
        fill="#c0392b"
        textAnchor="middle"
      >
        ✖ FAULT · seed fails
      </text>
    </g>
  );
}

function HandlerWidget({
  xLeft,
  machine,
}: {
  xLeft: number;
  machine: ReturnType<typeof useGameStore.getState>["machine"];
}) {
  const width = 300;
  return (
    <div
      style={{
        position: "absolute",
        top: 150,
        left: Math.max(8, xLeft - width / 2),
        width,
        background: SURFACE.panelWarm,
        border: `2px solid ${SURFACE.ink}`,
        boxShadow: "3px 3px 0 rgba(36,67,95,.2)",
        fontFamily: FONT.mono,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.85,
        padding: "8px 12px",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span>Δ HANDLER</span>
        <span style={{ color: ZONE.accent }}>on TaskCommandStatus</span>
      </div>
      {machine ? (
        <>
          {machine.rules.map((r) => (
            <div key={`${r.from}-${r.on}`} style={{ color: ENUM_COLOR[r.on] }}>
              {r.on} → {r.action === "terminal" ? "terminal ✔" : r.action}
              {r.action === "retry" && r.budget != null ? ` (max ${r.budget})` : ""}
            </div>
          ))}
          <div style={{ color: ENUM_COLOR.CANCELED, opacity: 0.6 }}>CANCELED → (legend only)</div>
        </>
      ) : (
        <div style={{ fontFamily: FONT.hand, fontWeight: 400, color: "rgba(36,67,95,.6)" }}>
          No handlers wired yet — wiring is Phase 2 editing (S5). Open with ?ref=1 to preview the
          reference machine.
        </div>
      )}
    </div>
  );
}
