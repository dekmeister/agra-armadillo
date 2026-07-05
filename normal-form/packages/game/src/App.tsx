// The app shell. Two screens (WS-C): the `select` drawing index and the `play`
// Blueprint puzzle screen. The play screen is the full-viewport vertical stack —
// header band, goal/run sub-bar, the three-column main row (palette · board ·
// inspector), and the bottom row (validator console · title block). One screen,
// three phases; the chrome is identical across phases, only the board/inspector/
// console bodies change.
import { useEffect } from "react";
import { Board } from "./Board.tsx";
import { Header } from "./Header.tsx";
import { HowToPlay } from "./HowToPlay.tsx";
import { Inspector } from "./Inspector.tsx";
import { Palette } from "./Palette.tsx";
import { SheetSelect } from "./SheetSelect.tsx";
import { SubBar } from "./SubBar.tsx";
import { useGameStore } from "./store.ts";
import { TitleBlock } from "./TitleBlock.tsx";
import { FONT, LAYOUT, SURFACE } from "./tokens.ts";
import { UciReference } from "./UciReference.tsx";
import { usePlayback } from "./usePlayback.ts";
import { useRun } from "./useRun.ts";
import { ValidatorConsole } from "./ValidatorConsole.tsx";
import { WelcomeCard } from "./WelcomeCard.tsx";

/** Certify the current sheet the moment all its seeds pass on the RUN screen —
 *  this is what unlocks the next sheet + persists progress. */
function useCertify() {
  const phase = useGameStore((s) => s.phase);
  const certifyCurrent = useGameStore((s) => s.certifyCurrent);
  const { allPass } = useRun();
  useEffect(() => {
    if (phase === "run" && allPass) certifyCurrent();
  }, [phase, allPass, certifyCurrent]);
}

function PlayScreen() {
  usePlayback();
  useCertify();
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

export function App() {
  const screen = useGameStore((s) => s.screen);
  const overlay = useGameStore((s) => s.overlay);
  return (
    <>
      {screen === "select" ? <SheetSelect /> : <PlayScreen />}
      {overlay === "reference" && <UciReference />}
      {overlay === "howto" && <HowToPlay />}
      {overlay === "welcome" && <WelcomeCard />}
    </>
  );
}
