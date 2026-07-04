// The SVG sequence-diagram board (handoff § Component: Board) — the hero. A
// vertical time axis (t0…tN), two lifelines at 36% / 74%, and message arrows
// colored by state enum. In RUN the arrows reveal as the tick advances, driven by
// the engine's frames; in COMPOSE/HANDLERS the board is a static shell of the
// sheet's initial state (editing is S5).
import type { Machine, Score } from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ArrowFrame } from "./frames.ts";
import type { Phase } from "./store.ts";
import { useGameStore } from "./store.ts";
import { ENUM_COLOR, FONT, LAYOUT, SURFACE, ZONE } from "./tokens.ts";
import { useFindings } from "./useFindings.ts";
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
  const runSpeed = useGameStore((s) => s.runSpeed);
  const seedId = useGameStore((s) => s.seedId);
  const placed = useGameStore((s) => s.session.placed);
  const { board, machine, allPass, score } = useRun();
  const errorCount = useFindings().length;

  const xLeft = w * (LAYOUT.lifelineLeftPct / 100);
  const xRight = w * (LAYOUT.lifelineRightPct / 100);
  const yTop = 78;
  const yBottom = Math.max(yTop + 40, h - 26);
  const rulerMax = Math.max(6, board?.endTick ?? 0);
  const yOf = (t: number) => yTop + (t / rulerMax) * (yBottom - yTop);

  // Animation durations, a fraction of the per-tick window so each completes
  // before the next tick fires.
  const drawMs = Math.min(runSpeed * 0.6, 480);
  const tokenMs = Math.min(runSpeed * 0.7, 520);

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

          {/* playhead — a sweep line at the current tick that glides down the axis */}
          {phase === "run" && <Playhead y={yOf(tick)} width={w} durMs={runSpeed} />}

          {/* arrows */}
          {phase === "run" ? (
            <>
              {board?.arrows
                .filter((a) => a.tick <= tick)
                .map((a) => (
                  <Arrow
                    key={a.key}
                    frame={a}
                    xLeft={xLeft}
                    xRight={xRight}
                    y={yOf(a.tick)}
                    animateDraw
                    drawMs={drawMs}
                  />
                ))}
              {/* in-flight token(s) riding the arrow(s) arriving at this tick */}
              {board?.arrows
                .filter((a) => a.tick === tick)
                .map((a) => (
                  <MovingToken
                    key={`tok-${a.key}-${tick}`}
                    frame={a}
                    xLeft={xLeft}
                    xRight={xRight}
                    y={yOf(a.tick)}
                    durMs={tokenMs}
                  />
                ))}
            </>
          ) : placed ? (
            renderShellArrows(phase, xLeft, xRight, yOf)
          ) : (
            <text
              x={(xLeft + xRight) / 2}
              y={yOf(2)}
              fontFamily={FONT.hand}
              fontSize={15}
              fill="rgba(36,67,95,.5)"
              textAnchor="middle"
            >
              ◂ click Command-2 in the palette to place its arrow pair
            </text>
          )}

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
          {phase === "compose" && placed && errorCount > 0 && (
            <RejectStamp w={w} count={errorCount} />
          )}
          {phase === "run" &&
            board?.goalTick != null &&
            tick >= board.goalTick &&
            board.fault === null && <GoalStamp w={w} h={h} seedId={seedId} />}
          {phase === "run" && board?.fault != null && tick >= board.fault.tick && (
            <FaultStamp w={w} y={yOf(board.fault.tick)} />
          )}
          {/* seed-② hang: the run finished with no proof and no fault */}
          {phase === "run" &&
            board != null &&
            board.goalTick === null &&
            board.fault === null &&
            tick >= board.endTick &&
            board.endTick > 0 && <NoGoalStamp w={w} h={h} />}
        </svg>
      )}

      {/* handler widget (HTML overlay) — read-only mirror of the built machine */}
      {phase === "handlers" && placed && <HandlerWidget xLeft={xLeft} machine={machine} />}

      {/* certification overlay — all three seeds pass */}
      {phase === "run" && allPass && score && <CertifiedOverlay score={score} />}
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
  animateDraw = false,
  drawMs = 480,
}: {
  frame: ArrowFrame;
  xLeft: number;
  xRight: number;
  y: number;
  /** draw the shaft in from sender→receiver on first reveal (RUN only) */
  animateDraw?: boolean;
  drawMs?: number;
}) {
  const isRequest = frame.dir === "request";
  const opacity = frame.muted ? 0.45 : 1;
  const headX = isRequest ? xRight : xLeft;
  const glyph = isRequest ? "▶" : "◀";
  // Draw from the sender end: request grows left→right, response right→left.
  const senderX = isRequest ? xLeft : xRight;
  const receiverX = isRequest ? xRight : xLeft;
  const len = Math.abs(xRight - xLeft);
  const doDraw = animateDraw && !frame.dashed;
  const [drawn, setDrawn] = useState(!doDraw);
  useEffect(() => {
    if (!doDraw) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [doDraw]);
  return (
    <g opacity={opacity}>
      <line
        x1={senderX}
        y1={y}
        x2={receiverX}
        y2={y}
        stroke={frame.color}
        strokeWidth={frame.check ? 3 : 2.5}
        strokeDasharray={frame.dashed ? "6 5" : doDraw ? `${len}` : undefined}
        strokeDashoffset={doDraw ? (drawn ? 0 : len) : undefined}
        style={doDraw ? { transition: `stroke-dashoffset ${drawMs}ms ease-out` } : undefined}
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
      {frame.disposition && (
        <text
          x={(xLeft + xRight) / 2}
          y={y + 13}
          fontFamily={FONT.mono}
          fontSize={9}
          fontWeight={700}
          fill="#c0392b"
          textAnchor="middle"
        >
          ✖ ignored · {frame.disposition}
        </text>
      )}
    </g>
  );
}

/** A message packet that rides an arrow from its sender lifeline to the receiver. */
function MovingToken({
  frame,
  xLeft,
  xRight,
  y,
  durMs,
}: {
  frame: ArrowFrame;
  xLeft: number;
  xRight: number;
  y: number;
  durMs: number;
}) {
  const isRequest = frame.dir === "request";
  const from = isRequest ? xLeft : xRight;
  const to = isRequest ? xRight : xLeft;
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMoved(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <circle
      cx={from}
      cy={y}
      r={5.5}
      fill={frame.color}
      stroke="#fff"
      strokeWidth={1.5}
      style={{
        transform: `translateX(${moved ? to - from : 0}px)`,
        transition: `transform ${durMs}ms cubic-bezier(.4,0,.2,1)`,
      }}
    />
  );
}

/** The current-tick sweep line; glides down the time axis as playback advances. */
function Playhead({ y, width, durMs }: { y: number; width: number; durMs: number }) {
  return (
    <g
      style={{
        transform: `translateY(${y}px)`,
        transition: `transform ${durMs}ms linear`,
      }}
    >
      <line
        x1={0}
        y1={0}
        x2={width}
        y2={0}
        stroke={ZONE.accent}
        strokeWidth={1}
        strokeDasharray="2 4"
        opacity={0.55}
      />
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

function RejectStamp({ w, count }: { w: number; count: number }) {
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
        ✖ REJECTED · {count} ERR
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

function NoGoalStamp({ w, h }: { w: number; h: number }) {
  return (
    <g transform={`translate(${w / 2 - 150}, ${h - 96}) rotate(-6)`}>
      <rect width={300} height={40} fill="rgba(192,57,43,.08)" stroke="#c0392b" strokeWidth={3} />
      <text
        x={150}
        y={26}
        fontFamily={FONT.mono}
        fontSize={15}
        fontWeight={800}
        fill="#c0392b"
        textAnchor="middle"
      >
        ✖ NO PROOF · seed fails
      </text>
    </g>
  );
}

function CertifiedOverlay({ score }: { score: Score }) {
  const pars = sheet_1_1.pars;
  const metrics: { label: string; value: number; par: number; suffix?: string }[] = [
    { label: "MSG", value: score.messages, par: pars.messages },
    { label: "SIZE", value: score.machineSize, par: pars.machineSize },
    { label: "TICK", value: score.ticks, par: pars.ticks, suffix: "≤" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        right: 14,
        background: "rgba(47,143,91,.1)",
        border: "2.5px solid #2f8f5b",
        boxShadow: "3px 3px 0 rgba(47,143,91,.25)",
        padding: "8px 12px",
        fontFamily: FONT.mono,
        zIndex: 3,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#2f8f5b", marginBottom: 4 }}>
        ✔ CERTIFIED · all seeds pass
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {metrics.map((m) => (
          <span key={m.label} style={{ fontSize: 11, fontWeight: 700 }}>
            <span style={{ opacity: 0.6 }}>{m.label} </span>
            <span style={{ color: m.value <= m.par ? "#2f8f5b" : "#c07d1f" }}>{m.value}</span>
            <span style={{ opacity: 0.5 }}>
              /{m.suffix ?? ""}
              {m.par}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HandlerWidget({ xLeft, machine }: { xLeft: number; machine: Machine }) {
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
      {machine.rules.length > 0 ? (
        <>
          {machine.rules.map((r) => (
            <div key={`${r.from}-${r.on}`} style={{ color: ENUM_COLOR[r.on] }}>
              {r.on} → {r.action === "terminal" ? "terminal ✔" : r.action}
              {r.action === "retry" && r.budget != null ? ` (max ${r.budget})` : ""}
              {r.target ? ` ⇒ ${r.target}` : ""}
            </div>
          ))}
          <div style={{ color: ENUM_COLOR.CANCELED, opacity: 0.6 }}>CANCELED → (legend only)</div>
        </>
      ) : (
        <div style={{ fontFamily: FONT.hand, fontWeight: 400, color: "rgba(36,67,95,.6)" }}>
          No rules wired yet — pick an action per enum in the inspector.
        </div>
      )}
    </div>
  );
}
