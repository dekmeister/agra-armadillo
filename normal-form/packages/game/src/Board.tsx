// The SVG sequence-diagram board (handoff § Component: Board) — the hero. A
// vertical time axis (t0…tN), two lifelines at 36% / 74%, and message arrows
// colored by state enum. In RUN the arrows reveal as the tick advances, driven by
// the engine's frames; in COMPOSE/HANDLERS the board is a static shell of the
// sheet's initial state (editing is S5).
import { correctPatternFor, type Job, type Machine } from "@normal-form/core";
import { nextSheetId } from "@normal-form/levels";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ArrowFrame, OneWayFrame } from "./frames.ts";
import {
  circled,
  isJobs,
  isOneWay,
  isRequestRun,
  type PrimaryBinding,
  primaryBinding,
} from "./sheet.ts";
import { allRequiredCertified, type Phase, useGameStore } from "./store.ts";
import { ENUM_COLOR, FONT, LAYOUT, REQUEST_ENUM_COLOR, STATUS, SURFACE, ZONE } from "./tokens.ts";
import { useFindings } from "./useFindings.ts";
import { useRun } from "./useRun.ts";

/** The board is a sequence diagram; its shape follows the pattern. Command-2 sheets
 *  get the two-party request/response board; one-way (`-1`) sheets get the producer
 *  → N-consumer fan-out (WS-E). */
export function Board() {
  const oneWay = useGameStore((s) => isOneWay(s.sheet));
  const jobs = useGameStore((s) => isJobs(s.sheet));
  const request = useGameStore((s) => isRequestRun(s.sheet));
  if (jobs) return <JobsBoard />;
  if (request) return <RequestBoard />;
  return oneWay ? <OneWayBoard /> : <CommandBoard />;
}

/** Split a lifeline label like "Commander (you)" into its name and "(tag)". */
function splitLabel(label: string): { name: string; tag: string } {
  const m = label.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  return m ? { name: m[1] ?? label, tag: m[2] ?? "" } : { name: label, tag: "" };
}

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

function CommandBoard() {
  const [ref, { w, h }] = useSize();
  const sheet = useGameStore((s) => s.sheet);
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const runSpeed = useGameStore((s) => s.runSpeed);
  const seedId = useGameStore((s) => s.seedId);
  const placed = useGameStore((s) => s.session.placed);
  const { board, machine, allPass } = useRun();
  const binding = primaryBinding(sheet);
  const commander = sheet.lifelines.find((l) => l.player) ?? sheet.lifelines[0];
  const commandee = sheet.lifelines.find((l) => !l.player) ?? sheet.lifelines[1];
  // Compose reject stamp counts only the field findings (V1–V9); the terminal-
  // handler readiness gate (V10, code "READY") is a handlers-phase state, not a
  // compose error, so it must not stamp the board (WS-B — matches the console).
  const errorCount = useFindings().filter((f) => f.code !== "READY").length;

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
          sequence · {splitLabel(commander?.label ?? "Commander").name} ⇄{" "}
          {splitLabel(commandee?.label ?? "Commandee").name}
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
          <LifelineHeader
            x={xLeft}
            label={splitLabel(commander?.label ?? "Commander").name}
            tag={splitLabel(commander?.label ?? "Commander").tag}
            tagColor={ZONE.accent}
          />
          <LifelineHeader
            x={xRight}
            label={splitLabel(commandee?.label ?? "Commandee").name}
            tag={splitLabel(commandee?.label ?? "Commandee").tag}
            tagColor="rgba(36,67,95,.6)"
          />
          <line
            x1={xLeft}
            y1={58}
            x2={xLeft}
            y2={yBottom + 12}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <line
            x1={xRight}
            y1={58}
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
            renderShellArrows(phase, xLeft, xRight, yOf, binding)
          ) : (
            <text
              x={(xLeft + xRight) / 2}
              y={yOf(2)}
              fontFamily={FONT.hand}
              fontSize={15}
              fill="rgba(36,67,95,.5)"
              textAnchor="middle"
            >
              ◂ click {binding.pattern} in the palette to place its arrow pair
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

      {/* certification overlay — every seed passes */}
      {phase === "run" && allPass && <CertifiedOverlay />}
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
  // Boxes sit below the top-left "DIAGRAM …" zone caption (top:10). A left-hugging
  // lifeline (the fan-out producer at 0.15w) would otherwise collide with the
  // caption at 1024px — the smallest supported viewport (WS-G polish, REVIEW_MVP Q4).
  return (
    <g>
      <rect
        x={x - boxW / 2}
        y={28}
        width={boxW}
        height={30}
        fill={SURFACE.chrome}
        stroke={SURFACE.ink}
        strokeWidth={2}
      />
      <text
        x={x}
        y={48}
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
  binding: PrimaryBinding,
) {
  const req = (
    <Arrow
      key="shell-req"
      frame={{
        key: "req",
        dir: "request",
        tick: 1,
        label: `${binding.request} →`,
        color: ZONE.oneWay,
      }}
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
            label: `← ${binding.response} ⟨unset⟩`,
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
          label: `← ${binding.response}`,
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
        ✔ GOAL REACHED · seed {circled(seedId)} pass
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

function CertifiedOverlay() {
  const sheet = useGameStore((s) => s.sheet);
  const hasNext = useGameStore((s) => nextSheetId(s.sheet.id) !== undefined);
  const goNextSheet = useGameStore((s) => s.goNextSheet);
  const backToSelect = useGameStore((s) => s.backToSelect);
  // The epilogue debrief unlocks the moment every required sheet is certified —
  // offered here as a second action so the milestone is reachable from the run
  // (WS-G). It never replaces NEXT SHEET, so the bonus sheet stays reachable.
  const openEpilogue = useGameStore((s) => s.openEpilogue);
  const debriefReady = useGameStore((s) => allRequiredCertified(s.certified));
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        right: 14,
        maxWidth: 260,
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
      {/* the sheet's recap line — the one-sentence lesson (replaces the score row) */}
      <div style={{ fontFamily: FONT.hand, fontSize: 14, fontWeight: 500, color: SURFACE.ink }}>
        {sheet.recap}
      </div>
      <button
        type="button"
        onClick={hasNext ? goNextSheet : backToSelect}
        style={{
          marginTop: 8,
          background: "#2f8f5b",
          color: "#fff",
          border: "none",
          borderRadius: 3,
          padding: "5px 11px",
          fontFamily: FONT.mono,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".04em",
          cursor: "pointer",
        }}
      >
        {hasNext ? "NEXT SHEET ▸" : "◂ BACK TO INDEX"}
      </button>
      {debriefReady && (
        <button
          type="button"
          onClick={openEpilogue}
          style={{
            marginTop: 6,
            marginLeft: 8,
            background: "transparent",
            color: "#2f8f5b",
            border: "1.5px solid #2f8f5b",
            borderRadius: 3,
            padding: "4px 10px",
            fontFamily: FONT.mono,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".04em",
            cursor: "pointer",
          }}
        >
          ▤ VIEW DEBRIEF
        </button>
      )}
    </div>
  );
}

// --- One-way (`-1`) fan-out board (WS-E) -----------------------------------

/** Producer → N-consumer fan-out board. Publications ride from the producer to
 *  each consumer at their delivery tick; a Data-1 consumer's freshness shows as a
 *  green band that decays after `staleAfter` ticks (a gap = stale). */
function OneWayBoard() {
  const [ref, { w, h }] = useSize();
  const sheet = useGameStore((s) => s.sheet);
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const runSpeed = useGameStore((s) => s.runSpeed);
  const placed = useGameStore((s) => s.session.placed);
  const { oneWayBoard: model, allPass } = useRun();
  const { publication, pattern } = primaryBinding(sheet);
  const producer = sheet.lifelines.find((l) => l.player) ?? sheet.lifelines[0];
  const consumers = sheet.lifelines.filter((l) => !l.player);
  const errorCount = useFindings().length;

  const producerX = w * 0.15;
  const n = Math.max(1, consumers.length);
  const consumerX = (i: number) => w * (n === 1 ? 0.65 : 0.45 + (0.45 * i) / (n - 1));
  const xById = new Map(consumers.map((c, i) => [c.id, consumerX(i)]));

  const yTop = 78;
  const yBottom = Math.max(yTop + 40, h - 26);
  const rulerMax = Math.max(6, model?.endTick ?? 0);
  const yOf = (t: number) => yTop + (Math.min(t, rulerMax) / rulerMax) * (yBottom - yTop);
  const drawMs = Math.min(runSpeed * 0.6, 480);

  const stale = model?.staleAfter ?? null;
  const revealed = (model?.frames ?? []).filter((f) => f.tick <= tick);

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
          fan-out · {pattern} → {consumers.length} consumer{consumers.length === 1 ? "" : "s"}
        </span>
      </div>

      {w > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0 }}
          role="img"
          aria-label="fan-out sequence diagram"
        >
          <title>Fan-out — producer to consumers</title>

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

          {/* goal window bracket (hold sheets) / deadline line (status sheets) */}
          {model?.window && (
            <rect
              x={producerX + 8}
              y={yOf(model.window.from)}
              width={w - producerX - 16}
              height={yOf(model.window.to) - yOf(model.window.from)}
              fill="rgba(47,143,91,.05)"
              stroke="rgba(47,143,91,.4)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          {model?.deadline != null && (
            <line
              x1={producerX}
              y1={yOf(model.deadline)}
              x2={w - 10}
              y2={yOf(model.deadline)}
              stroke={STATUS.fail}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.6}
            />
          )}

          {/* producer + consumer lifelines */}
          <LifelineHeader
            x={producerX}
            label={splitLabel(producer?.label ?? "Producer").name}
            tag={splitLabel(producer?.label ?? "Producer").tag}
            tagColor={ZONE.accent}
          />
          <line
            x1={producerX}
            y1={58}
            x2={producerX}
            y2={yBottom + 12}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          {consumers.map((c, i) => (
            <g key={c.id}>
              <LifelineHeader
                x={consumerX(i)}
                label={splitLabel(c.label).name}
                tag={splitLabel(c.label).tag}
                tagColor="rgba(36,67,95,.6)"
              />
              <line
                x1={consumerX(i)}
                y1={58}
                x2={consumerX(i)}
                y2={yBottom + 12}
                stroke="rgba(36,67,95,.55)"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </g>
          ))}

          {/* freshness bands (RUN, Data-1 hold): each receipt keeps the consumer
              fresh for `staleAfter` ticks; a gap between bands is a stale window */}
          {phase === "run" &&
            stale != null &&
            revealed
              .filter((f) => !f.dropped)
              .map((f) => {
                const x = xById.get(f.consumer);
                if (x == null) return null;
                return (
                  <rect
                    key={`hold-${f.key}`}
                    x={x - 5}
                    y={yOf(f.tick)}
                    width={10}
                    height={yOf(f.tick + stale) - yOf(f.tick)}
                    fill="rgba(47,143,91,.22)"
                  />
                );
              })}

          {/* playhead */}
          {phase === "run" && <Playhead y={yOf(tick)} width={w} durMs={runSpeed} />}

          {/* publications */}
          {phase === "run"
            ? revealed.map((f) => {
                const x = xById.get(f.consumer);
                if (x == null) return null;
                return (
                  <PublicationArrow
                    key={f.key}
                    frame={f}
                    fromX={producerX}
                    toX={x}
                    y={yOf(f.tick)}
                    drawMs={drawMs}
                  />
                );
              })
            : placed
              ? consumers.map((c, i) => (
                  <PublicationArrow
                    key={`shell-${c.id}`}
                    frame={{
                      key: `shell-${c.id}`,
                      tick: 1,
                      consumer: c.id,
                      send: 0,
                      dropped: false,
                      dup: false,
                    }}
                    fromX={producerX}
                    toX={consumerX(i)}
                    y={yOf(1)}
                    label={i === 0 ? `${publication} ▶` : undefined}
                    shell
                  />
                ))
              : null}

          {!placed && phase !== "run" && (
            <text
              x={(producerX + w) / 2}
              y={yOf(2)}
              fontFamily={FONT.hand}
              fontSize={15}
              fill="rgba(36,67,95,.5)"
              textAnchor="middle"
            >
              ◂ click {pattern} in the palette to place its publication
            </text>
          )}

          {/* stamps */}
          {phase === "compose" && placed && errorCount > 0 && (
            <RejectStamp w={w} count={errorCount} />
          )}
          {phase === "run" && model?.goalTick != null && tick >= model.goalTick && (
            <GoalStamp w={w} h={h} seedId={useGameStore.getState().seedId} />
          )}
          {phase === "run" &&
            model != null &&
            model.goalTick === null &&
            tick >= model.endTick &&
            model.endTick > 0 && <NoGoalStamp w={w} h={h} />}
        </svg>
      )}

      {phase === "run" && allPass && <CertifiedOverlay />}
    </div>
  );
}

/** One producer→consumer publication arrow (delivered, dropped, or a static shell). */
function PublicationArrow({
  frame,
  fromX,
  toX,
  y,
  drawMs = 480,
  label,
  shell = false,
}: {
  frame: OneWayFrame;
  fromX: number;
  toX: number;
  y: number;
  drawMs?: number;
  label?: string;
  shell?: boolean;
}) {
  const color = frame.dropped ? STATUS.fail : ZONE.oneWay;
  const len = Math.abs(toX - fromX);
  const doDraw = !shell && !frame.dropped;
  const [drawn, setDrawn] = useState(!doDraw);
  useEffect(() => {
    if (!doDraw) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [doDraw]);
  // A dropped publication never reaches the consumer — draw it fading out partway.
  const endX = frame.dropped ? fromX + (toX - fromX) * 0.5 : toX;
  return (
    <g opacity={frame.dropped ? 0.5 : 1}>
      <line
        x1={fromX}
        y1={y}
        x2={endX}
        y2={y}
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={frame.dropped || shell ? "6 5" : doDraw ? `${len}` : undefined}
        strokeDashoffset={doDraw ? (drawn ? 0 : len) : undefined}
        style={doDraw ? { transition: `stroke-dashoffset ${drawMs}ms ease-out` } : undefined}
      />
      {!frame.dropped && (
        <text
          x={toX}
          y={y + 4}
          fontFamily={FONT.mono}
          fontSize={12}
          fontWeight={800}
          fill={color}
          textAnchor="middle"
        >
          ▶
        </text>
      )}
      {frame.dropped && (
        <text
          x={endX + 10}
          y={y + 4}
          fontFamily={FONT.mono}
          fontSize={11}
          fontWeight={800}
          fill={STATUS.fail}
          textAnchor="middle"
        >
          ✖ dropped
        </text>
      )}
      {label && (
        <text
          x={(fromX + toX) / 2}
          y={y - 6}
          fontFamily={FONT.mono}
          fontSize={11}
          fontWeight={700}
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function HandlerWidget({ xLeft, machine }: { xLeft: number; machine: Machine }) {
  const sheet = useGameStore((s) => s.sheet);
  const { response } = primaryBinding(sheet);
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
        <span style={{ color: ZONE.accent }}>on {response}</span>
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

// --- Classification board (0-3) --------------------------------------------

/** The per-job delivery latency the jobs sim uses (mirrors `runSeedJobs`: a
 *  correctly-classified job delivers to its party one tick after RUN starts). 0-3's
 *  seeds only reorder — they don't perturb ticks or drop — so this is faithful. */
const JOB_LATENCY = 1;

/** How a job resolves, and the tick its outcome becomes visible on RUN. */
interface JobOutcome {
  readonly kind: "served" | "filed" | "unresolved";
  readonly revealTick: number;
  readonly pattern?: string;
}

function jobOutcome(ask: Job["ask"], pattern: string | undefined, isFiled: boolean): JobOutcome {
  // Filing is instantaneous (a certification act, not a delivery) → tick 0.
  if (isFiled) return { kind: "filed", revealTick: 0 };
  // A correct pattern delivers at the latency tick; anything else never serves.
  if (pattern && pattern === correctPatternFor(ask))
    return { kind: "served", revealTick: JOB_LATENCY, pattern };
  return { kind: "unresolved", revealTick: JOB_LATENCY, pattern };
}

/** Producer → per-job party board. In TRIAGE each job is one edge labeled by the
 *  player's choice (assigned pattern / FILED / unassigned). On RUN the outcome
 *  reveals as the tick advances: the filed job stamps at t0, a correctly-classified
 *  job's arrow wipes in at its delivery tick, and an unserved job surfaces as a miss
 *  — so PLAY/STEP animate the triage the same way the other boards animate delivery. */
function JobsBoard() {
  const [ref, { w, h }] = useSize();
  const sheet = useGameStore((s) => s.sheet);
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const runSpeed = useGameStore((s) => s.runSpeed);
  const jobPatterns = useGameStore((s) => s.session.jobPatterns);
  const filed = useGameStore((s) => s.session.filed);
  const jobs = sheet.jobs ?? [];
  const producer = sheet.lifelines.find((l) => l.player) ?? sheet.lifelines[0];

  const producerX = w * 0.15;
  const partyX = w * 0.72;
  const len = partyX - producerX;
  const yTop = 90;
  const rowGap = 62;
  const running = phase === "run";
  const drawMs = Math.min(runSpeed * 0.6, 480);

  /** Resolve a job to its edge appearance for the current phase + tick. */
  const view = (job: (typeof jobs)[number]) => {
    const o = jobOutcome(job.ask, jobPatterns[job.id], (filed[job.id] ?? []).length > 0);
    if (!running) {
      // TRIAGE: show the player's current choice (right vs wrong is revealed on RUN).
      if (o.kind === "filed")
        return {
          color: ZONE.stamp,
          mid: "⚑ FILED · request needs a -2",
          dashed: true,
          head: false,
        };
      if (o.pattern) return { color: ZONE.accent, mid: o.pattern, dashed: false, head: true };
      return { color: "rgba(36,67,95,.5)", mid: "— unassigned —", dashed: true, head: false };
    }
    const revealed = tick >= o.revealTick;
    if (o.kind === "served")
      return {
        color: STATUS.pass,
        mid: revealed ? `✓ served · ${o.pattern}` : "",
        dashed: false,
        head: revealed,
        draw: true,
        drawn: revealed,
      };
    if (o.kind === "filed")
      return {
        color: ZONE.stamp,
        mid: revealed ? "✓ FILED · correctly unservable (needs a -2)" : "",
        dashed: true,
        head: false,
        pending: !revealed,
      };
    return {
      color: STATUS.fail,
      mid: revealed ? (o.pattern ? `✗ ${o.pattern} — not served` : "✗ not served") : "",
      dashed: true,
      head: false,
      pending: !revealed,
    };
  };

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
          triage · {jobs.length} job{jobs.length === 1 ? "" : "s"}
          {running ? ` · t${tick}` : ""}
        </span>
      </div>

      {w > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0 }}
          role="img"
          aria-label="classification jobs diagram"
        >
          <title>Classification — producer to per-job parties</title>
          <LifelineHeader
            x={producerX}
            label={splitLabel(producer?.label ?? "Producer").name}
            tag={splitLabel(producer?.label ?? "Producer").tag}
            tagColor={ZONE.accent}
          />
          <line
            x1={producerX}
            y1={58}
            x2={producerX}
            y2={h - 20}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          {jobs.map((job, i) => {
            const y = yTop + i * rowGap;
            const v = view(job);
            const party = sheet.lifelines.find((ll) => ll.id === job.party);
            const opacity = "pending" in v && v.pending ? 0.25 : 1;
            const drawing = "draw" in v && v.draw;
            return (
              <g key={job.id} opacity={opacity}>
                <line
                  x1={producerX}
                  y1={y}
                  x2={partyX}
                  y2={y}
                  stroke={v.color}
                  strokeWidth={2}
                  strokeDasharray={drawing ? `${len}` : v.dashed ? "6 5" : undefined}
                  strokeDashoffset={drawing ? (v.drawn ? 0 : len) : undefined}
                  style={
                    drawing
                      ? { transition: `stroke-dashoffset ${drawMs}ms ease ${i * 110}ms` }
                      : undefined
                  }
                />
                {v.head && (
                  <polygon
                    points={`${partyX},${y} ${partyX - 9},${y - 4} ${partyX - 9},${y + 4}`}
                    fill={v.color}
                  />
                )}
                <text
                  x={(producerX + partyX) / 2}
                  y={y - 7}
                  fontFamily={FONT.mono}
                  fontSize={11}
                  fontWeight={700}
                  fill={v.color}
                  textAnchor="middle"
                >
                  {job.id.toUpperCase()}
                  {v.mid ? ` · ${v.mid}` : ""}
                </text>
                <text
                  x={partyX + 12}
                  y={y + 4}
                  fontFamily={FONT.mono}
                  fontSize={11}
                  fontWeight={700}
                  fill={SURFACE.ink}
                >
                  {splitLabel(party?.label ?? job.party).name}
                </text>
                <text
                  x={(producerX + partyX) / 2}
                  y={y + 15}
                  fontFamily={FONT.hand}
                  fontSize={11}
                  fill="rgba(36,67,95,.6)"
                  textAnchor="middle"
                >
                  {job.ask}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// --- Request-run board (bonus 1-5 "Cancel Culture") ------------------------

/** The two-party ActionRequest-2 board: the opening request + the player's injected
 *  CANCEL travel to the requestee; QUEUED / PROCESSING / the terminal come back. It
 *  reuses the Command-2 board chrome (Arrow / MovingToken / stamps) off the shared
 *  `BoardModel` that `runFramesRequest` produces. No handler widget, no reject stamp
 *  — the compose gate is envelope-only and the run has no machine fault. */
function RequestBoard() {
  const [ref, { w, h }] = useSize();
  const sheet = useGameStore((s) => s.sheet);
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const runSpeed = useGameStore((s) => s.runSpeed);
  const seedId = useGameStore((s) => s.seedId);
  const placed = useGameStore((s) => s.session.placed);
  const cancelAt = useGameStore((s) => s.session.cancelAt);
  const { board, allPass } = useRun();
  const binding = primaryBinding(sheet);
  const requester = sheet.lifelines.find((l) => l.player) ?? sheet.lifelines[0];
  const requestee = sheet.lifelines.find((l) => !l.player) ?? sheet.lifelines[1];

  const xLeft = w * (LAYOUT.lifelineLeftPct / 100);
  const xRight = w * (LAYOUT.lifelineRightPct / 100);
  const yTop = 78;
  const yBottom = Math.max(yTop + 40, h - 26);
  const rulerMax = Math.max(6, board?.endTick ?? 0);
  const yOf = (t: number) => yTop + (Math.min(t, rulerMax) / rulerMax) * (yBottom - yTop);
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
          request · {splitLabel(requester?.label ?? "Requester").name} ⇄{" "}
          {splitLabel(requestee?.label ?? "Requestee").name}
        </span>
      </div>

      {w > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0 }}
          role="img"
          aria-label="request sequence diagram"
        >
          <title>Sequence diagram — Requester to Requestee</title>

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

          <LifelineHeader
            x={xLeft}
            label={splitLabel(requester?.label ?? "Requester").name}
            tag={splitLabel(requester?.label ?? "Requester").tag}
            tagColor={ZONE.accent}
          />
          <LifelineHeader
            x={xRight}
            label={splitLabel(requestee?.label ?? "Requestee").name}
            tag={splitLabel(requestee?.label ?? "Requestee").tag}
            tagColor="rgba(36,67,95,.6)"
          />
          <line
            x1={xLeft}
            y1={58}
            x2={xLeft}
            y2={yBottom + 12}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <line
            x1={xRight}
            y1={58}
            x2={xRight}
            y2={yBottom + 12}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />

          {phase === "run" && <Playhead y={yOf(tick)} width={w} durMs={runSpeed} />}

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
            <>
              <Arrow
                key="shell-req"
                frame={{
                  key: "req",
                  dir: "request",
                  tick: 1,
                  label: `${binding.request} NEW →`,
                  color: ZONE.oneWay,
                }}
                xLeft={xLeft}
                xRight={xRight}
                y={yOf(1)}
              />
              {cancelAt != null && (
                <Arrow
                  key="shell-cancel"
                  frame={{
                    key: "cancel",
                    dir: "request",
                    tick: cancelAt,
                    label: "CANCEL →",
                    color: REQUEST_ENUM_COLOR.CANCELED ?? ENUM_COLOR.CANCELED,
                    dashed: true,
                  }}
                  xLeft={xLeft}
                  xRight={xRight}
                  y={yOf(cancelAt)}
                />
              )}
              <text
                x={(xLeft + xRight) / 2}
                y={yOf(rulerMax) - 6}
                fontFamily={FONT.hand}
                fontSize={13}
                fill="rgba(36,67,95,.5)"
                textAnchor="middle"
              >
                {cancelAt != null
                  ? "RUN to see whether your CANCEL beats COMPLETED"
                  : "set a CANCEL tick, then RUN"}
              </text>
            </>
          ) : (
            <text
              x={(xLeft + xRight) / 2}
              y={yOf(2)}
              fontFamily={FONT.hand}
              fontSize={15}
              fill="rgba(36,67,95,.5)"
              textAnchor="middle"
            >
              ◂ click {binding.pattern} in the palette to place the request
            </text>
          )}

          {/* activity mark on the requestee lifeline (only when COMPLETED won) */}
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

          {phase === "run" && board?.goalTick != null && tick >= board.goalTick && (
            <GoalStamp w={w} h={h} seedId={seedId} />
          )}
          {phase === "run" &&
            board != null &&
            board.goalTick === null &&
            tick >= board.endTick &&
            board.endTick > 0 && <NoGoalStamp w={w} h={h} />}
        </svg>
      )}

      {phase === "run" && allPass && <CertifiedOverlay />}
    </div>
  );
}
