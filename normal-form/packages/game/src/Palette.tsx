// Palette column (handoff § Component: Palette): two grouped lists of interaction
// primitives. Command-2 is the active chip this sheet; the other five are locked.
// Lock/unlock is read from the sheet's palette data.
import { sheet_1_1 } from "@normal-form/levels";
import { FONT, LAYOUT, RADIUS, SHADOW, SURFACE, ZONE } from "./tokens.ts";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"] as const;

interface Group {
  heading: string;
  color: string;
  patterns: readonly string[];
}

// Grouping + display order per the handoff (not the sheet's array order).
const GROUPS: readonly Group[] = [
  { heading: "ONE-WAY", color: ZONE.oneWay, patterns: ["Status-1", "Data-1", "DataRecord-1"] },
  {
    heading: "SEND · RESPOND",
    color: ZONE.sendRespond,
    patterns: ["DataRequest-2", "ActionRequest-2", "Command-2"],
  },
];

const UNLOCKED = new Set(sheet_1_1.palette.filter((p) => p.unlocked).map((p) => p.pattern));

// Stable ①–⑤ index across all locked primitives, in handoff order.
const LOCKED_ORDER = GROUPS.flatMap((g) => g.patterns).filter((p) => !UNLOCKED.has(p));
const lockIndex = (pattern: string) => LOCKED_ORDER.indexOf(pattern);

function LockedChip({ pattern, color }: { pattern: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "1px dashed rgba(36,67,95,.4)",
        borderLeft: `3px solid ${color}`,
        padding: "6px 8px",
        borderRadius: RADIUS.chip,
        opacity: 0.55,
        fontFamily: FONT.mono,
      }}
    >
      <span style={{ fontSize: 13, color }}>{CIRCLED[lockIndex(pattern)] ?? "○"}</span>
      <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{pattern}</span>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".08em" }}>LOCK</span>
    </div>
  );
}

function ActiveChip({ pattern }: { pattern: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: ZONE.accentFill,
        border: `2px solid ${ZONE.accent}`,
        borderLeft: `5px solid ${ZONE.accent}`,
        boxShadow: SHADOW.amber2,
        padding: "7px 8px",
        borderRadius: RADIUS.chip,
        fontFamily: FONT.mono,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: ZONE.accent }} />
      <span style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>{pattern}</span>
      <span style={{ fontSize: 8, fontWeight: 700, color: ZONE.accent, letterSpacing: ".08em" }}>
        READY
      </span>
    </div>
  );
}

export function Palette() {
  return (
    <aside
      style={{
        width: LAYOUT.paletteW,
        flex: `0 0 ${LAYOUT.paletteW}px`,
        background: SURFACE.panelWarm,
        borderRight: "1.5px dashed #24435f",
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
          padding: "10px 12px",
          borderBottom: `1.5px solid ${SURFACE.ink}`,
        }}
      >
        <span style={{ width: 9, height: 9, background: ZONE.oneWay }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".07em" }}>PALETTE</span>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {GROUPS.map((g) => (
          <div key={g.heading} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: g.color,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".08em",
              }}
            >
              <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.4 }} />
              {g.heading}
              <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.4 }} />
            </div>
            {g.patterns.map((p) =>
              UNLOCKED.has(p) ? (
                <ActiveChip key={p} pattern={p} />
              ) : (
                <LockedChip key={p} pattern={p} color={g.color} />
              ),
            )}
          </div>
        ))}
      </div>

      <p
        style={{
          fontFamily: FONT.hand,
          fontSize: 12,
          color: "rgba(36,67,95,.6)",
          borderTop: "1px dashed rgba(36,67,95,.4)",
          margin: 0,
          padding: "8px 12px",
        }}
      >
        Only Command-2 is unlocked this sheet. Drag it onto a lifeline to place its arrow pair.
      </p>
    </aside>
  );
}
