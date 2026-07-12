// Validator / console (handoff § Component: Validator / Console). A core mechanic:
// players study this text, so it quotes the standard verbatim and stays ≥13px.
// COMPOSE lists the S3 field findings (V1–V9); HANDLERS surfaces the terminal-handler
// readiness gate (V10) as an amber HANDLERS NOT READY state, not a compose error
// (05-mvp amendment 3); RUN streams the per-tick event log for the selected seed.

import { FINDINGS, type Finding, type RunEvent, type Sheet } from "@normal-form/core";
import { circled, isOneWay } from "./sheet.ts";
import { useGameStore } from "./store.ts";
import { ENUM_COLOR, FONT, RADIUS, STATUS, SURFACE, ZONE } from "./tokens.ts";
import { useFindings } from "./useFindings.ts";
import { useRun } from "./useRun.ts";

/** V10 (the terminal-handler readiness gate) carries this finding code; it is a
 *  readiness state, not a compose field error, so it is channeled separately. */
const READINESS_CODE = "READY";

function Badge({ text, bg }: { text: string; bg: string }) {
  return (
    <span
      style={{
        marginLeft: "auto",
        background: bg,
        color: "#fff",
        fontSize: 10,
        fontWeight: 800,
        padding: "2px 9px",
        borderRadius: RADIUS.badge,
      }}
    >
      {text}
    </span>
  );
}

function FindingLine({ f }: { f: Finding }) {
  const [tag, ...restCode] = f.code.split(" ");
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, color: STATUS.fail }}>
      <span style={{ fontWeight: 800 }}>✖</span>
      <span
        style={{
          background: STATUS.fail,
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          padding: "1px 6px",
          borderRadius: RADIUS.chip,
        }}
      >
        {tag}
      </span>
      <span>
        {restCode.join(" ")} — {f.message}
      </span>
    </div>
  );
}

/** Failure replay: the violated rule quoted verbatim + a jump-to-the-tick button. */
function FailureReplay({
  lesson,
  onScrub,
}: {
  lesson: { code: string; message: string; docRef: string; quote?: string };
  onScrub: () => void;
}) {
  const [tag, ...rest] = lesson.code.split(" ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, color: STATUS.fail }}>
        <span style={{ fontWeight: 800 }}>✖</span>
        <span
          style={{
            background: STATUS.fail,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "1px 6px",
            borderRadius: RADIUS.chip,
          }}
        >
          {tag}
        </span>
        <span>
          {rest.join(" ")} — {lesson.message}
        </span>
      </div>
      {lesson.quote && (
        <div style={{ fontStyle: "italic", fontWeight: 500, color: "rgba(36,67,95,.8)" }}>
          “{lesson.quote}” <span style={{ opacity: 0.6 }}>— {lesson.docRef}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onScrub}
        style={{
          alignSelf: "flex-start",
          marginTop: 2,
          background: SURFACE.ink,
          color: SURFACE.vellum,
          border: "none",
          borderRadius: RADIUS.pill,
          padding: "4px 10px",
          fontFamily: FONT.mono,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ⤳ scrub to fault
      </button>
    </div>
  );
}

function busPolicy(sheet: Sheet, seedId: number): string {
  const seed = sheet.seeds.find((s) => s.id === seedId);
  const op = seed?.schedule[0]?.op;
  return op ? op.toUpperCase() : "IN-ORDER";
}

/** Render one engine RunEvent as a legible console line. `gated` reframes an
 *  unhandled drop as the sequencing footgun so the seed-② hang reads plainly. */
function eventLine(ev: RunEvent, gated: boolean): { text: string; color: string } {
  const dim = "rgba(36,67,95,.75)";
  switch (ev.kind) {
    case "command-sent":
      return { text: `${ev.detail} sent →`, color: dim };
    case "status-delivered":
      // detail is `${state} → ${terminal|wait}`.
      return { text: `${ev.detail}`, color: SURFACE.ink };
    case "status-dropped": {
      // detail is `${state[ (dup)]} — ${disposition}`.
      const [head, disp] = ev.detail.split(" — ").map((s) => s.trim());
      const state = head ?? ev.detail;
      if (disp === "unhandled") {
        return gated
          ? {
              text: `${state} arrived before RECEIVED — machine still waiting (gated)`,
              color: STATUS.fail,
            }
          : { text: `${state} — no handler armed`, color: STATUS.fail };
      }
      if (disp === "post-terminal")
        return { text: `${state} — ignored, already terminal`, color: dim };
      if (disp === "not-correlated")
        return { text: `${state} — ignored, not your CommandID`, color: dim };
      return { text: ev.detail, color: dim };
    }
    case "activity-executed":
      return { text: "SystemB performed the activity", color: ENUM_COLOR.ACCEPTED };
    case "goal-reached":
      return { text: "✔ goal reached", color: STATUS.pass };
    case "fault":
      return { text: `✖ ${ev.detail}`, color: STATUS.fail };
    // one-way (`-1`) producer path (World 0; wired into the UI in WS-E E2):
    case "published":
      return { text: `▲ ${ev.detail}`, color: dim };
    case "datum-delivered":
      return { text: ev.detail, color: SURFACE.ink };
    case "status-shown":
      return { text: ev.detail, color: ENUM_COLOR.ACCEPTED };
    case "datum-stale":
      return { text: `${ev.detail} — stale`, color: dim };
    case "datum-dropped":
      return { text: `${ev.detail} — dropped`, color: STATUS.fail };
  }
}

export function ValidatorConsole() {
  const sheet = useGameStore((s) => s.sheet);
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const seedId = useGameStore((s) => s.seedId);
  const setTick = useGameStore((s) => s.setTick);
  const gated = useGameStore((s) => s.session.gateAccepted);
  const oneWay = useGameStore((s) => isOneWay(s.sheet));
  const findings = useFindings();
  const { seedResults, machine, board, oneWayBoard, result } = useRun();
  const failure = board?.failure ?? oneWayBoard?.failure ?? null;

  // Split the field findings (V1–V9, the compose gate) from the terminal-handler
  // readiness gate (V10). Compose reads clean once the fields are fixed; a missing
  // terminal handler is an amber readiness state, not a compose error.
  const composeFindings = findings.filter((f) => f.code !== READINESS_CODE);
  const notReady = findings.some((f) => f.code === READINESS_CODE);
  const errorCount = composeFindings.length;

  let badge: React.ReactNode = null;
  if (phase === "compose") {
    badge =
      errorCount === 0 ? (
        <Badge text="0 ERRORS · READY" bg={STATUS.pass} />
      ) : (
        <Badge text={`${errorCount} ERRORS · RUN BLOCKED`} bg={STATUS.fail} />
      );
  } else if (phase === "handlers") {
    badge =
      errorCount > 0 ? (
        <Badge text={`${errorCount} ERRORS · RUN BLOCKED`} bg={STATUS.fail} />
      ) : notReady ? (
        <Badge text="HANDLERS NOT READY" bg={ZONE.accent} />
      ) : (
        <Badge text="0 ERRORS · READY" bg={STATUS.pass} />
      );
  } else {
    badge = <Badge text={`RUNNING · SEED ${circled(seedId)}`} bg={SURFACE.ink} />;
  }

  const seedPass = seedResults.find((r) => r.seedId === seedId)?.pass;

  return (
    <section
      style={{
        flex: 1,
        background: SURFACE.console,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT.mono,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(36,67,95,.15)",
        }}
      >
        <span style={{ width: 9, height: 9, background: "#b23a2e" }} />
        <span style={{ fontSize: 12, fontWeight: 800 }}>VALIDATOR</span>
        {badge}
      </div>

      <div
        style={{
          padding: "10px 14px",
          fontSize: 13.5,
          fontWeight: 700,
          lineHeight: 1.95,
          overflow: "auto",
          color: SURFACE.ink,
        }}
      >
        {phase === "compose" && (
          <>
            {composeFindings.map((f) => (
              <FindingLine key={f.id} f={f} />
            ))}
            <div style={{ color: errorCount === 0 ? STATUS.pass : "rgba(36,67,95,.55)" }}>
              {errorCount === 0
                ? "✔ composition validates clean · wire handlers, then RUN."
                : "▸ fix the flagged fields in the inspector to unblock RUN."}
            </div>
          </>
        )}

        {phase === "handlers" && oneWay && (
          <>
            <div style={{ color: errorCount > 0 ? STATUS.fail : STATUS.pass }}>
              {errorCount > 0
                ? `✖ ${errorCount} blocking field errors · fix COMPOSE first`
                : "✔ READY · set the publish plan, then RUN the seeds"}
            </div>
            <div style={{ color: "rgba(36,67,95,.55)" }}>
              ▸ a -1 datum owes no delivery — republish faster than it goes stale.
            </div>
          </>
        )}

        {phase === "handlers" && !oneWay && (
          <>
            <div
              style={{
                color: errorCount > 0 ? STATUS.fail : notReady ? ZONE.accent : STATUS.pass,
              }}
            >
              {errorCount > 0
                ? `✖ ${errorCount} blocking field errors · fix COMPOSE first`
                : notReady
                  ? `▲ HANDLERS NOT READY · ${machine.rules.length} rules wired`
                  : `✔ READY · ${machine.rules.length} handler rules wired`}
            </div>
            <div style={{ color: "rgba(36,67,95,.55)" }}>
              ▸ wire a rule for every reachable terminal state to reach READY.
            </div>
          </>
        )}

        {phase === "run" && (
          <>
            <div>
              ▸ tick {tick} · bus policy: <b>{busPolicy(sheet, seedId)}</b>
              {seedPass !== undefined && (
                <span style={{ color: seedPass ? STATUS.pass : STATUS.fail }}>
                  {" "}
                  · seed {seedPass ? "PASS" : "FAIL"}
                </span>
              )}
            </div>
            {/* per-tick event log, revealed as playback advances (replaces the old
                static RECEIVED → ACCEPTED line — 05-mvp amendment 4). */}
            {result?.log
              .filter((ev) => ev.tick <= tick)
              .map((ev) => {
                const line = eventLine(ev, gated);
                return (
                  <div
                    key={`${ev.tick}-${ev.kind}-${ev.detail}`}
                    style={{ color: line.color, display: "flex", gap: 8 }}
                  >
                    <span style={{ opacity: 0.5, minWidth: 30 }}>t{ev.tick}</span>
                    <span>{line.text}</span>
                  </div>
                );
              })}
            {seedPass === false && failure && (
              <FailureReplay
                lesson={FINDINGS[failure.lessonId]}
                onScrub={() => setTick(failure.tick)}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
