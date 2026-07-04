// Header band (handoff § Component: Header band): title cluster + sheet chip. The
// phase tabs used to live here on the right, but they're now stacked sections in
// the Inspector (the panel they drive) — see Inspector.tsx.
import { sheet_1_1 } from "@normal-form/levels";
import { FONT, LAYOUT, RADIUS, SURFACE } from "./tokens.ts";

export function Header() {
  return (
    <header
      style={{
        height: LAYOUT.headerH,
        flex: `0 0 ${LAYOUT.headerH}px`,
        background: SURFACE.ink,
        color: SURFACE.vellum,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontFamily: FONT.mono,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".04em" }}>NORMAL FORM</span>
        <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.65, letterSpacing: ".05em" }}>
          SEQUENCE CERTIFICATION
        </span>
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          border: "1px solid rgba(243,239,228,.4)",
          padding: "2px 9px",
          borderRadius: RADIUS.chip,
        }}
      >
        SHEET {sheet_1_1.id} · {sheet_1_1.title}
      </span>
    </header>
  );
}
