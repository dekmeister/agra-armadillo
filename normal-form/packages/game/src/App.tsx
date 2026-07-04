// The Blueprint puzzle screen (S4): full-viewport vertical stack — header band,
// goal/metrics sub-bar, the three-column main row (palette · board · inspector),
// and the bottom row (validator console · title block). One screen, three phases;
// the chrome is identical across phases, only the board/inspector/console bodies
// change. RUN is wired to the real engine; COMPOSE/HANDLERS are read-only shells
// until editing lands in S5.
import { Board } from "./Board.tsx";
import { Header } from "./Header.tsx";
import { Inspector } from "./Inspector.tsx";
import { Palette } from "./Palette.tsx";
import { SubBar } from "./SubBar.tsx";
import { TitleBlock } from "./TitleBlock.tsx";
import { FONT, LAYOUT, SURFACE } from "./tokens.ts";
import { usePlayback } from "./usePlayback.ts";
import { ValidatorConsole } from "./ValidatorConsole.tsx";

export function App() {
  usePlayback();
  return (
    <div
      style={{
        minWidth: LAYOUT.minWidth,
        height: "100dvh",
        minHeight: LAYOUT.minHeight,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: SURFACE.vellum,
        color: SURFACE.ink,
        fontFamily: FONT.mono,
      }}
    >
      <Header />
      <SubBar />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Palette />
        <Board />
        <Inspector />
      </div>
      <div
        style={{
          height: LAYOUT.bottomH,
          flex: `0 0 ${LAYOUT.bottomH}px`,
          display: "flex",
          borderTop: `1.5px solid ${SURFACE.ink}`,
        }}
      >
        <ValidatorConsole />
        <TitleBlock />
      </div>
    </div>
  );
}
