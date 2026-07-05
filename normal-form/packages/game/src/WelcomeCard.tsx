// Welcome card (WS-D; docs/06-how-to-play.md "Welcome card copy"). First-visit
// orientation, shown only when no save exists (store gates on hasSave). Copy is
// verbatim from the spec; reuses the FidelityNotes backdrop + centered dialog idiom.
import { FIRST_SHEET_ID } from "@normal-form/levels";
import { useGameStore } from "./store.ts";
import { FONT, SURFACE, ZONE } from "./tokens.ts";

export function WelcomeCard() {
  const startFromWelcome = useGameStore((s) => s.startFromWelcome);
  const openHowTo = useGameStore((s) => s.openHowTo);
  const openReference = useGameStore((s) => s.openReference);

  // The spec copy hardcodes "SHEET 0-1"; W0 isn't built yet (WS-E), so the START
  // label tracks the actual first sheet — renders "SHEET 1-1" today, "0-1" once
  // W0 lands and becomes FIRST_SHEET_ID.
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(36,67,95,.35)", zIndex: 60 }} />
      <div
        role="dialog"
        aria-label="Welcome to Normal Form"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflow: "auto",
          background: SURFACE.vellum,
          border: `2px solid ${SURFACE.ink}`,
          boxShadow: "4px 4px 0 rgba(36,67,95,.3)",
          fontFamily: FONT.mono,
          color: SURFACE.ink,
          zIndex: 61,
          textAlign: "left",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1.5px solid ${SURFACE.ink}`,
            background: SURFACE.chrome,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".04em" }}>NORMAL FORM</div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: ".06em" }}>
            SEQUENCE CERTIFICATION
          </div>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            <b>UCI — the Universal Command and Control (C2) Interface — is a messaging standard</b>:
            a common grammar that lets independently built systems command, query, and inform each
            other without sharing code, hardware, or even a transport. This game teaches you that
            grammar.
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            <b>You are a certification engineer.</b> Each <i>sheet</i> is a job: compose a message
            interaction between two components, wire the small machine that handles the responses,
            then prove it survives a bus that is allowed to reorder, duplicate, and drop — because
            the real standard guarantees none of those things.
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            Everything on the board is real: the message names, the fields, the state enums, and
            every rule that fails you is quoted verbatim from the standard.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 4,
              paddingTop: 12,
              borderTop: "1px dashed rgba(36,67,95,.4)",
            }}
          >
            <button
              type="button"
              onClick={startFromWelcome}
              style={{
                background: ZONE.accent,
                color: "#fff",
                border: `2px solid ${ZONE.accent}`,
                borderRadius: 3,
                padding: "8px 16px",
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".04em",
                cursor: "pointer",
              }}
            >
              START — SHEET {FIRST_SHEET_ID}
            </button>
            <button
              type="button"
              onClick={openHowTo}
              style={{
                background: "transparent",
                color: SURFACE.ink,
                border: `1.5px solid ${SURFACE.ink}`,
                borderRadius: 3,
                padding: "8px 14px",
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              HOW TO PLAY
            </button>
            <button
              type="button"
              onClick={() => openReference()}
              style={{
                background: "transparent",
                color: SURFACE.ink,
                border: `1.5px solid ${SURFACE.ink}`,
                borderRadius: 3,
                padding: "8px 14px",
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              UCI REFERENCE
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
