// Validator / console (handoff § Component: Validator / Console). A core mechanic:
// players study this text, so it quotes the standard verbatim and stays ≥13px.
// COMPOSE lists the S3 validator findings; HANDLERS shows the READY summary; RUN
// reports the live tick + bus policy for the selected seed.

import { FINDINGS, type Finding } from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { useGameStore } from "./store.ts";
import { ENUM_COLOR, FONT, RADIUS, STATUS, SURFACE } from "./tokens.ts";
import { useFindings } from "./useFindings.ts";
import { useRun } from "./useRun.ts";

const CIRCLED = ["①", "②", "③"] as const;

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

function busPolicy(seedId: number): string {
  const seed = sheet_1_1.seeds.find((s) => s.id === seedId);
  const op = seed?.schedule[0]?.op;
  return op ? op.toUpperCase() : "IN-ORDER";
}

export function ValidatorConsole() {
  const phase = useGameStore((s) => s.phase);
  const tick = useGameStore((s) => s.tick);
  const seedId = useGameStore((s) => s.seedId);
  const setTick = useGameStore((s) => s.setTick);
  const findings = useFindings();
  const { all, machine, board } = useRun();

  const errorCount = findings.length;

  let badge: React.ReactNode = null;
  if (phase === "compose" || phase === "handlers") {
    badge =
      errorCount === 0 ? (
        <Badge text="0 ERRORS · READY" bg={STATUS.pass} />
      ) : (
        <Badge text={`${errorCount} ERRORS · RUN BLOCKED`} bg={STATUS.fail} />
      );
  } else {
    badge = <Badge text={`RUNNING · SEED ${CIRCLED[seedId - 1] ?? seedId}`} bg={SURFACE.ink} />;
  }

  const seedPass = all?.results.find((r) => r.seedId === seedId)?.pass;

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
            {findings.map((f) => (
              <FindingLine key={f.id} f={f} />
            ))}
            <div style={{ color: errorCount === 0 ? STATUS.pass : "rgba(36,67,95,.55)" }}>
              {errorCount === 0
                ? "✔ composition validates clean · wire handlers, then RUN."
                : "▸ fix the flagged fields in the inspector to unblock RUN."}
            </div>
          </>
        )}

        {phase === "handlers" && (
          <>
            <div style={{ color: errorCount === 0 ? STATUS.pass : STATUS.fail }}>
              {errorCount === 0 ? "✔" : "✖"} {errorCount} blocking errors · {machine.rules.length}{" "}
              handler rules wired · machine size {machine.rules.length}/{sheet_1_1.pars.machineSize}
            </div>
            <div style={{ color: "rgba(36,67,95,.55)" }}>
              ▸ wire a rule for every reachable terminal state to reach READY.
            </div>
          </>
        )}

        {phase === "run" && (
          <>
            <div>
              ▸ tick {tick} · bus policy: <b>{busPolicy(seedId)}</b>
              {seedPass !== undefined && (
                <span style={{ color: seedPass ? STATUS.pass : STATUS.fail }}>
                  {" "}
                  · seed {seedPass ? "PASS" : "FAIL"}
                </span>
              )}
            </div>
            {seedPass === false && board?.failure ? (
              <FailureReplay
                lesson={FINDINGS[board.failure.lessonId]}
                onScrub={() => setTick(board.failure!.tick)}
              />
            ) : (
              <div>
                <span style={{ color: ENUM_COLOR.RECEIVED }}>RECEIVED</span> →{" "}
                <span style={{ color: ENUM_COLOR.ACCEPTED }}>ACCEPTED</span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
