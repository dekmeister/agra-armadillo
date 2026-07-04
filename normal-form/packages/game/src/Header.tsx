// Header band (handoff § Component: Header band): title cluster + sheet chip on
// the left, the three phase tabs on the right (amber fill when active).
import { sheet_1_1 } from "@normal-form/levels";
import { type Phase, useGameStore } from "./store.ts";
import { FONT, LAYOUT, RADIUS, SURFACE } from "./tokens.ts";

const TABS: readonly { phase: Phase; label: string }[] = [
  { phase: "compose", label: "1 · COMPOSE" },
  { phase: "handlers", label: "2 · HANDLERS" },
  { phase: "run", label: "3 · RUN" },
];

export function Header() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);

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
      </div>

      <nav style={{ display: "flex", gap: 5 }}>
        {TABS.map((t) => {
          const active = phase === t.phase;
          return (
            <button
              type="button"
              key={t.phase}
              onClick={() => setPhase(t.phase)}
              style={{
                padding: "6px 15px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".05em",
                borderRadius: RADIUS.chip,
                fontFamily: FONT.mono,
                cursor: "pointer",
                border: active ? "1px solid #c07d1f" : "1px solid rgba(243,239,228,.35)",
                background: active ? "#c07d1f" : "rgba(243,239,228,.1)",
                color: active ? SURFACE.ink : SURFACE.vellum,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
