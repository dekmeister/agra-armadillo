// HOW TO PLAY overlay (WS-D; docs/06-how-to-play.md "HOW TO PLAY screen copy").
// A full-viewport Blueprint document (styled like SheetSelect); copy verbatim from
// the spec. Closes back to the sheet exactly as left (store overlay, not a route).
import { useGameStore } from "./store.ts";
import { BORDER, FONT, RADIUS, STATUS, SURFACE, ZONE } from "./tokens.ts";

function H({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: ".03em",
        color: SURFACE.ink,
        margin: "22px 0 8px",
        paddingBottom: 4,
        borderBottom: "1px dashed rgba(36,67,95,.4)",
      }}
    >
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, lineHeight: 1.65 }}>
      {children}
    </p>
  );
}

const STAMP_ROWS: { glyph: string; color: string; body: React.ReactNode }[] = [
  {
    glyph: "✖ REJECTED · n ERR",
    color: STATUS.fail,
    body: "the validator blocked you at compose time.",
  },
  {
    glyph: "HANDLERS NOT READY",
    color: ZONE.accent,
    body: "composition is clean but the machine can't reach a terminal state yet.",
  },
  {
    glyph: "✖ NO PROOF",
    color: STATUS.fail,
    body: "the run ended and your machine was still waiting (a hang: it assumed an ordering or a delivery the bus never owed it).",
  },
  {
    glyph: "✖ FAULT",
    color: STATUS.fail,
    body: "your machine acted when it should have ignored (e.g. re-fired on a duplicate after reaching a terminal state).",
  },
  {
    glyph: "✔ CERTIFIED",
    color: STATUS.pass,
    body: "goal reached on all seeds.",
  },
];

export function HowToPlay() {
  const closeOverlay = useGameStore((s) => s.closeOverlay);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        overflow: "auto",
        background: SURFACE.desk,
        color: SURFACE.ink,
        fontFamily: FONT.mono,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 780, padding: "32px 24px 64px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderBottom: `2px solid ${SURFACE.ink}`,
            paddingBottom: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: ".04em" }}>HOW TO PLAY</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(36,67,95,.65)" }}>
              NORMAL FORM · SEQUENCE CERTIFICATION
            </div>
          </div>
          <button
            type="button"
            onClick={closeOverlay}
            style={{
              background: "transparent",
              color: SURFACE.ink,
              border: BORDER.divider,
              borderRadius: RADIUS.pill,
              padding: "6px 12px",
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ◂ BACK
          </button>
        </div>

        <H>The idea</H>
        <P>
          You certify interactions between <b>UCI Components</b>. A sheet gives you a <b>goal</b>{" "}
          (always a real-world outcome — "SystemB performs the tasked activity; you hold proof" —
          never "message sent"), a <b>palette</b> of interaction patterns, and a hostile <b>bus</b>.
          Pass every seed and the sheet is stamped <b>CERTIFIED</b>.
        </P>

        <H>The screen</H>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65 }}>
          <li style={{ marginBottom: 6 }}>
            <b>PALETTE</b> (left) — the six UCI interaction patterns. The unlocked chip is this
            sheet's tool; click it to place its arrows. Locked chips still teach: click any of them
            to read what that pattern is for.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>DIAGRAM</b> (center) — the board <i>is</i> a sequence diagram, the standard's own
            notation: lifelines are components, arrows are messages, time runs downward in ticks.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>INSPECTOR</b> (right) — the workbench, in three sections top to bottom:{" "}
            <b>COMPOSE</b> (fill the message's envelope and ID fields), <b>HANDLERS</b> (one rule
            per response state: <code>wait</code>, <code>terminal ✔</code>, or <code>retry</code>),{" "}
            <b>RUN</b> (the seed list and results).
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>VALIDATOR</b> (bottom) — the game's voice. Compose errors, readiness, the run's
            tick-by-tick event log, and — when a seed kills you — the violated rule quoted verbatim
            from the standard.
          </li>
          <li>
            <b>TITLE BLOCK</b> (bottom-right) — sheet metadata and the ⚑ FIDELITY NOTES panel:
            exactly where the game simplifies the real standard.
          </li>
        </ul>

        <H>The loop</H>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65 }}>
          <li style={{ marginBottom: 6 }}>
            <b>Compose.</b> Place the pattern, then fix the envelope: sheets arrive with broken
            fields, and the validator blocks RUN until it's clean — just like the real certification
            tooling.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Wire handlers.</b> Decide what your machine does on each response state. Beware
            anything you <i>inherited</i> — pre-wired templates carry assumptions.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Run every seed.</b> Seed ① is the polite, in-order bus. The rest are legal cruelty:
            the standard says{" "}
            <i>
              "there can be no assumption that messages come in any order or that there is
              guaranteed delivery"
            </i>{" "}
            — so the seeds reorder, duplicate, and (for fire-and-forget patterns) drop.{" "}
            <b>RUN ALL</b> checks every seed at once; click a failed seed to watch it, and{" "}
            <b>⤳ scrub to fault</b> to jump to the tick where your assumption broke.
          </li>
          <li style={{ marginBottom: 6 }}>
            <b>Read the failure.</b> Every failure quotes the rule you violated, chapter and verse.
            The fix is always in the quote.
          </li>
          <li>
            <b>CERTIFIED</b> — all seeds pass, the recap line names what you proved, and the next
            sheet unlocks.
          </li>
        </ol>

        <H>Reading the stamps</H>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {STAMP_ROWS.map((r) => (
            <div key={r.glyph} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span
                style={{
                  flex: "0 0 168px",
                  fontSize: 11,
                  fontWeight: 800,
                  color: r.color,
                  letterSpacing: ".03em",
                }}
              >
                {r.glyph}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.55 }}>{r.body}</span>
            </div>
          ))}
        </div>

        <H>The one big rule</H>
        <P>
          The bus owes you nothing. Any machine that assumes ordering, delivery, or exactly-once
          will die on some seed — and the seed will show you exactly which assumption it was.
          Robustness <i>is</i> the puzzle; the standard's normalized behaviors are the answer key.
        </P>
      </div>
    </div>
  );
}
