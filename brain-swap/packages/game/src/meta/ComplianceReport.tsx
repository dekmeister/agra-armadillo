// End-of-run screen, styled as a compliance test record (docs/01 "Scoring"). It is an
// After-Action Debrief, not a checklist: PASS/FAIL is the mission objective
// (outcome === "won"); below it, the level's ONE lesson + whether the player
// demonstrated it, a chronological recap of the player's own sends and FA's verdicts,
// and the scored metrics vs par. All of this is derived from the player's run via the
// headless core `evaluateDiagnostics` — never from the reference solution.

import { evaluateDiagnostics, type ScoredEvent, scoreWorld } from "@brain-swap/core";
import { finalFrame } from "../sim/timeline.ts";
import { useStore } from "../store.ts";
import { WORLDS } from "./levelCatalog.ts";
import { type Medal, medals } from "./medals.ts";

/** The next playable level after `id` in catalog order, or null if this is the last. */
function nextPlayableId(id: string): string | null {
  const playable = WORLDS.flatMap((w) => w.levels).filter((l) => l.playable);
  const i = playable.findIndex((l) => l.id === id);
  return i >= 0 && i < playable.length - 1 ? playable[i + 1]!.id : null;
}

function MetricBar({
  label,
  value,
  par,
  medal,
}: {
  label: string;
  value: number;
  par: number;
  medal: Medal;
}) {
  const max = Math.max(value, par, 1) * 1.3;
  const over = value > par;
  return (
    <div className="histo">
      <div className="ht">
        <span>
          {label}
          <span className={`metricmedal ${medal}`}>{medal === "none" ? "—" : medal}</span>
        </span>
        <span className={over ? "k-caution" : "k-phos"}>
          {value} <span className="k-dim">/ par {par}</span>
        </span>
      </div>
      <div className="bar">
        <div
          className={`fill${over ? " alert" : ""}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
        <div className="partick" style={{ left: `${(par / max) * 100}%` }} title={`par ${par}`} />
      </div>
    </div>
  );
}

const polarityMark = (p: ScoredEvent["polarity"]): string =>
  p === "positive" ? "+" : p === "negative" ? "✗" : "·";

export function ComplianceReport() {
  const level = useStore((s) => s.level);
  const body = useStore((s) => s.body);
  const timeline = useStore((s) => s.timeline);
  const script = useStore((s) => s.script);
  const setView = useStore((s) => s.setView);
  const restart = useStore((s) => s.restart);
  const selectLevel = useStore((s) => s.selectLevel);

  const w = finalFrame(timeline);
  const score = scoreWorld(w);
  const diag = evaluateDiagnostics(w, script, level);
  // The stamp reflects the mission objective; the lesson + recap below are the debrief.
  const allPass = w.outcome === "won";
  const pars = level.pars ?? { ticks: 0, busTraffic: 0, rejections: 0, brainSize: 0 };
  const m = medals(score, pars);
  const nextId = nextPlayableId(level.id);

  return (
    <div className="screen">
      <div className="report">
        <div className="titleblock">
          <div className="formid">FORM A-GRA/CTR-1.2 · COMPLIANCE TEST RECORD</div>
          <h1>COMPLIANCE TEST REPORT</h1>
          <div className="fields">
            <div>
              <span className="k">MISSION </span>
              <span className="v">
                {level.id} · {level.title}
              </span>
            </div>
            <div>
              <span className="k">BODY </span>
              <span className="v">
                {body.name} ({body.id})
              </span>
            </div>
            <div>
              <span className="k">STANDARD </span>
              <span className="v">A-GRA VI · ASK 5.0a</span>
            </div>
            <div>
              <span className="k">RUN </span>
              <span className="v">
                {w.outcome.toUpperCase()} · {score.ticks} ticks
              </span>
            </div>
          </div>
          {w.outcome !== "running" && (
            <div className={`stamp${allPass ? "" : " fail"}`}>{allPass ? "PASS" : "FAIL"}</div>
          )}
        </div>

        <section>
          <h2>Mission Lesson</h2>
          <div className={`lesson ${diag.lesson.demonstrated ? "ok" : "miss"}`}>
            <div className="lesson-chip">
              {diag.lesson.demonstrated ? "✓ DEMONSTRATED" : "✗ NOT DEMONSTRATED"}
            </div>
            <div className="lesson-text">{diag.lesson.lesson}</div>
            <div className="lesson-note">{diag.lesson.note}</div>
          </div>
        </section>

        <section>
          <h2>After-Action Recap</h2>
          <ul className="recap">
            {diag.events.map((e) => (
              <li key={`${e.tick ?? "x"}-${e.polarity}-${e.label}`} className={`recap-row ${e.polarity}`}>
                <span className="recap-tick">{e.tick != null ? `t${e.tick}` : ""}</span>
                <span className="recap-mark">{polarityMark(e.polarity)}</span>
                <span className="recap-label">
                  {e.label}
                  {e.detail ? <span className="recap-detail"> · {e.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="k-dim" style={{ fontSize: 9, marginTop: 6 }}>
            Your sends and FA's verdicts only — FA's periodic telemetry is omitted. The PASS/FAIL
            stamp above reflects the mission objective.
          </div>
        </section>

        <section>
          <h2>Metrics vs Par</h2>
          <div className="histos">
            <MetricBar label="Ticks" value={score.ticks} par={pars.ticks} medal={m.t} />
            <MetricBar
              label="Rejections"
              value={score.rejections}
              par={pars.rejections}
              medal={m.r}
            />
          </div>
          <div className="secondary-metric">
            <span className="sm-label">
              Bus Traffic <span className="k-dim">· secondary</span>
            </span>
            <span className={score.busTraffic > pars.busTraffic ? "k-caution" : "k-phos"}>
              {score.busTraffic} <span className="k-dim">/ par {pars.busTraffic}</span>
            </span>
            <span className={`metricmedal ${m.b}`}>{m.b === "none" ? "—" : m.b}</span>
          </div>
          <div className="k-dim" style={{ fontSize: 9, marginTop: 8 }}>
            Ticks and Rejections are the headline metrics; Bus Traffic is a secondary efficiency
            medal. Bars show your run against the level par.
          </div>
        </section>

        <div className="rfoot">
          <span className="cert">
            Judged by the in-game FA referee in the style of the official harness — passing Brain
            Swap is not A-GRA compliance (fidelity note #11).
          </span>
          <div className="right">
            <button type="button" className="btn" onClick={() => setView("select")}>
              Level Select
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                restart();
                setView("console");
              }}
            >
              Retry · Optimize
            </button>
            <button
              type="button"
              className="btn"
              disabled={!nextId}
              title={nextId ? `Go to level ${nextId}` : "No further playable levels"}
              onClick={() => nextId && selectLevel(nextId)}
            >
              Next Mission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
