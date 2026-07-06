// Fidelity Notes panel (docs/02-fidelity.md §3, §5; PLAN_MVP S6). The per-level
// honesty surface: the subset of "lies we tell" that sheet 1-1 touches, listed by
// the sheet's `fidelityNotes` keys. This is game commentary about the standard —
// not a policed verbatim quote (those live in the validator/failure findings).
import { useState } from "react";
import { useGameStore } from "./store.ts";
import { FONT, RADIUS, SURFACE, ZONE } from "./tokens.ts";

const NOTES: Record<string, { title: string; body: string }> = {
  "lie-1-bounded-seeds": {
    title: "#1 · Bounded seeds ≠ all interleavings",
    body: "Three seeds stand in for every legal ordering. Passing them proves robustness against these schedules, not universally — the game says “certified against 3 adversarial schedules,” never “proven correct.”",
  },
  "lie-2-visible-bus": {
    title: "#2 · The bus is visible",
    body: "Real UCI prescribes no transport at all — that absence is exactly why the spec forbids ordering and delivery assumptions. We render the adversary so you can reason about it.",
  },
  "lie-3-mode-exercise": {
    title: "#3 · EXERCISE mode is a teaching rule",
    body: "This envelope sheet runs as EXERCISE; the “Mode must match the sheet” check is a game rule for envelope literacy, not a spec CERT. The standard defines the MessageModeEnum values (LIVE / EXERCISE / SIMULATION / NONEXERCISE_SIMULATION), not a consumer filtering behavior.",
  },
  "lie-4-drops-oneway": {
    title: "#4 · Drops are scoped to -1 patterns",
    body: "The spec permits loss anywhere; we only ever drop fire-and-forget (Status-1/Data-1) arrows, for teachability. A dropped -2 request would just be a timeout-retry lesson, and retry-on-silence is not normalized behaviour we can cite.",
  },
  "lie-staleafter": {
    title: "Datum staleness is game apparatus",
    body: "A -1 datum “goes stale” a fixed number of ticks after each publication (staleAfter). The standard prescribes no freshness rule and leaves periodicity to the producer (SPC-001 §5.1.6). What is real: with no ack, republication is your only recourse — the staleness window just forces you to feel it.",
  },
  "lie-5-retry-budget": {
    title: "#5 · Retry budgets are a game rule",
    body: "UNIS normalizes what happens after a response arrives (the terminal-state rule); it does not prescribe requester timeout/retry policy. The REJECTED-path retry — a NEW command with a fresh UUID, never an UPDATE — is our reading of the enum’s annotations.",
  },
  "lie-9-placeholder-stamp": {
    title: "#9 · SCH-000164 was a mock placeholder",
    body: "The Blueprint mock stamped SCH-000164; the real SCH-000164 is about schema-file section ordering. The shipped validator cites honestly: a missing SystemID is an XSD validity failure against uci:HeaderType (ENV HeaderType), and a malformed UUID cites RQMT USTD-000436/-000673.",
  },
};

export function FidelityNotes() {
  const [open, setOpen] = useState(false);
  const sheet = useGameStore((s) => s.sheet);
  const keys = sheet.fidelityNotes ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: `1px solid ${SURFACE.ink}`,
          borderRadius: RADIUS.chip,
          padding: "3px 8px",
          fontFamily: FONT.mono,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: ".05em",
          color: SURFACE.ink,
          cursor: "pointer",
        }}
      >
        ⚑ FIDELITY NOTES
      </button>

      {open && (
        <>
          {/* dimmed backdrop — click to close (sibling of the panel, not a parent) */}
          <button
            type="button"
            aria-label="close fidelity notes"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(36,67,95,.35)",
              border: "none",
              zIndex: 50,
              cursor: "default",
            }}
          />
          <div
            role="dialog"
            aria-label="Fidelity notes"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 560,
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflow: "auto",
              background: SURFACE.vellum,
              border: `2px solid ${SURFACE.ink}`,
              boxShadow: "4px 4px 0 rgba(36,67,95,.3)",
              fontFamily: FONT.mono,
              color: SURFACE.ink,
              zIndex: 51,
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderBottom: `1.5px solid ${SURFACE.ink}`,
                background: SURFACE.chrome,
              }}
            >
              <span style={{ width: 9, height: 9, background: ZONE.stamp }} />
              <span style={{ fontSize: 13, fontWeight: 800 }}>
                FIDELITY NOTES · SHEET {sheet.id}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="close"
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  fontFamily: FONT.mono,
                  fontSize: 14,
                  fontWeight: 800,
                  color: SURFACE.ink,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {keys.map((k) => {
                const n = NOTES[k];
                if (!n) return null;
                return (
                  <div key={k}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: ZONE.stamp }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.55, marginTop: 2 }}>
                      {n.body}
                    </div>
                  </div>
                );
              })}
              <div style={{ fontFamily: FONT.hand, fontSize: 13, opacity: 0.65, paddingTop: 2 }}>
                Everything the game cites elsewhere is real and verbatim — the fidelity CI greps the
                UCI sources for every name, number, and quote.
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
