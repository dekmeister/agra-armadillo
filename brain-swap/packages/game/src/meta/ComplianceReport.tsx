// Score screen styled as a formal Compliance Test Report (docs/01, docs/05 step 7).
// PASS/FAIL is derived from the run's final message log (which Tier-1 VI interactions were
// exercised and succeeded); metrics are shown vs level pars. NOTE: real population
// histograms are a docs/05-deferred feature (item 6) — we show honest metric-vs-par bars,
// not a fabricated distribution.
import { useStore } from "../store.ts";
import { finalFrame } from "../sim/timeline.ts";
import { WORLDS } from "./levelCatalog.ts";
import { scoreWorld, type MessageLogEntry } from "@brain-swap/core";

/** The next playable level after `id` in catalog order, or null if this is the last. */
function nextPlayableId(id: string): string | null {
  const playable = WORLDS.flatMap((w) => w.levels).filter((l) => l.playable);
  const i = playable.findIndex((l) => l.id === id);
  return i >= 0 && i < playable.length - 1 ? playable[i + 1]!.id : null;
}

interface InteractionRow {
  vi: string;
  name: string;
  pass: boolean;
}

function deriveInteractions(log: readonly MessageLogEntry[]): InteractionRow[] {
  const has = (pred: (e: MessageLogEntry) => boolean) => log.some(pred);
  const payload = (e: MessageLogEntry) => e.payload as Record<string, unknown>;
  return [
    {
      vi: "§1.2.2.4",
      name: "Control Mode Authorization",
      pass:
        has((e) => e.type === "MA_FlightCapabilityMT") &&
        has((e) => e.type === "MA_FlightCapabilityStatusMT" && payload(e).Availability === "AVAILABLE"),
    },
    {
      vi: "§1.2.2.7",
      name: "Receive Control Request",
      pass:
        has((e) => e.type === "MA_ControlRequestMT") &&
        has((e) => e.type === "MA_ControlRequestStatusMT" && payload(e).ApprovalRequestProcessingState === "APPROVED"),
    },
    {
      vi: "§1.2.6.2",
      name: "Publish Control Status",
      pass: has((e) => e.type === "ControlStatusMT" && payload(e).SecondaryController === "MA"),
    },
    {
      vi: "§1.2.2.2",
      name: "Control by HSA/CSA Command",
      pass: has((e) => e.type === "MA_FlightCommandStatusMT" && payload(e).CommandProcessingState === "ACCEPTED"),
    },
    {
      vi: "§1.2.6.8",
      name: "Receive Vehicle State Data",
      pass: has((e) => e.type === "MA_PositionReportDetailedMT"),
    },
  ];
}

function MetricBar({ label, value, par }: { label: string; value: number; par: number }) {
  const max = Math.max(value, par, 1) * 1.3;
  const over = value > par;
  return (
    <div className="histo">
      <div className="ht">
        <span>{label}</span>
        <span className={over ? "k-caution" : "k-phos"}>
          {value} <span className="k-dim">/ par {par}</span>
        </span>
      </div>
      <div className="bar">
        <div className={`fill${over ? " alert" : ""}`} style={{ width: `${(value / max) * 100}%` }} />
        <div className="partick" style={{ left: `${(par / max) * 100}%` }} title={`par ${par}`} />
      </div>
    </div>
  );
}

export function ComplianceReport() {
  const level = useStore((s) => s.level);
  const body = useStore((s) => s.body);
  const timeline = useStore((s) => s.timeline);
  const setView = useStore((s) => s.setView);
  const restart = useStore((s) => s.restart);
  const selectLevel = useStore((s) => s.selectLevel);

  const w = finalFrame(timeline);
  const score = scoreWorld(w);
  const interactions = deriveInteractions(w.log);
  // The stamp reflects the mission outcome; the table below is an informational record of
  // which Tier-1 interactions the run exercised (not every level uses all of them).
  const allPass = w.outcome === "won";
  const pars = level.pars ?? { ticks: 0, busTraffic: 0, rejections: 0, brainSize: 0 };
  const nextId = nextPlayableId(level.id);

  return (
    <div className="screen">
      <div className="report">
        <div className="titleblock">
          <div className="formid">FORM A-GRA/CTR-1.2 · COMPLIANCE TEST RECORD</div>
          <h1>COMPLIANCE TEST REPORT</h1>
          <div className="fields">
            <div><span className="k">MISSION </span><span className="v">{level.id} · {level.title}</span></div>
            <div><span className="k">BODY </span><span className="v">{body.name} ({body.id})</span></div>
            <div><span className="k">STANDARD </span><span className="v">A-GRA VI · ASK 5.0a</span></div>
            <div><span className="k">RUN </span><span className="v">{w.outcome.toUpperCase()} · {score.ticks} ticks</span></div>
          </div>
          {w.outcome !== "running" && (
            <div className={`stamp${allPass ? "" : " fail"}`}>{allPass ? "PASS" : "FAIL"}</div>
          )}
        </div>

        <section>
          <h2>Tier-1 Interactions Exercised</h2>
          <table className="itable">
            <thead>
              <tr><th style={{ width: 80 }}>VI ID</th><th>Interaction</th><th style={{ width: 70 }}>Exercised</th></tr>
            </thead>
            <tbody>
              {interactions.map((i) => (
                <tr key={i.vi}>
                  <td className="k-dim">{i.vi}</td>
                  <td>{i.name}</td>
                  <td><span className={i.pass ? "pass" : "k-dim"}>{i.pass ? "✓ yes" : "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="k-dim" style={{ fontSize: 9, marginTop: 6 }}>
            Not every mission uses all five — e.g. the handshake level (1.1) never issues a flight
            command. The PASS/FAIL stamp above reflects the mission objective.
          </div>
        </section>

        <section>
          <h2>Metrics vs Par</h2>
          <div className="histos">
            <MetricBar label="Ticks" value={score.ticks} par={pars.ticks} />
            <MetricBar label="Bus Traffic" value={score.busTraffic} par={pars.busTraffic} />
            <MetricBar label="Rejections" value={score.rejections} par={pars.rejections} />
          </div>
          <div className="k-dim" style={{ fontSize: 9, marginTop: 8 }}>
            Population histograms with percentile ranking are deferred (docs/05 §6). Bars show your
            run against the level par.
          </div>
        </section>

        <div className="rfoot">
          <span className="cert">
            Judged by the in-game FA referee in the style of the official harness — passing Brain
            Swap is not A-GRA compliance (fidelity note #11).
          </span>
          <div className="right">
            <button className="btn" onClick={() => setView("select")}>Level Select</button>
            <button className="btn" onClick={() => { restart(); setView("console"); }}>Retry · Optimize</button>
            <button
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
