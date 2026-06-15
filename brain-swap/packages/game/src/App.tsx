// App shell: the secondary-screen selector strip + view routing, plus the single rAF
// loop that drives the deterministic sim. The clock (performance.now / rAF) lives ONLY
// here — the core stays headless (CLAUDE.md rule #3). In realtime mode the clock advances
// the LIVE EDGE of the run (store.advanceLive → inject pending inputs, then step); it
// pauses while the player is composing a message.
import { useEffect } from "react";
import { useStore, type View } from "./store.ts";
import { Console } from "./console/Console.tsx";
import { ComplianceReport } from "./meta/ComplianceReport.tsx";
import { LevelSelect } from "./meta/LevelSelect.tsx";
import { Help } from "./meta/Help.tsx";
import { MessageCodex } from "./meta/MessageCodex.tsx";
import { MobileGate } from "./ui/MobileGate.tsx";
import { WelcomeOverlay } from "./ui/WelcomeOverlay.tsx";

/** Ticks advanced per real second at 1× speed. 2×/8× scale this. */
const TICKS_PER_SECOND = 4;

function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when the user is typing in a form field.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const st = useStore.getState();
      if (st.view !== "console") return; // transport keys only on the console
      switch (e.key) {
        case " ":
          e.preventDefault();
          st.togglePlay();
          break;
        case "c":
        case "C":
          e.preventDefault();
          st.openComposer(); // compose a message to send (pauses the clock)
          break;
        case "ArrowRight":
          e.preventDefault();
          st.stepOne();
          break;
        case "1":
          st.setSpeed(1);
          break;
        case "2":
          st.setSpeed(2);
          break;
        case "3":
          st.setSpeed(8);
          break;
        case "r":
        case "R":
          st.restart();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

function usePlaybackClock() {
  const running = useStore((s) => s.running);
  const composing = useStore((s) => s.composing);
  const speed = useStore((s) => s.speed);

  useEffect(() => {
    if (!running || composing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tps = TICKS_PER_SECOND * speed;

    const loop = (now: number) => {
      acc += (now - last) / 1000;
      last = now;
      const advance = Math.floor(acc * tps);
      if (advance > 0) {
        acc -= advance / tps;
        // Advance the live edge: inject any composed inputs, then step. The store
        // stops + records the result itself when the run terminates.
        useStore.getState().advanceLive(advance);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, composing, speed]);
}

const NAV: { id: View; label: string }[] = [
  { id: "console", label: "Console" },
  { id: "report", label: "Test Report" },
  { id: "select", label: "Level Select" },
  { id: "codex", label: "Messages" },
  { id: "help", label: "Help" },
];

export function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  usePlaybackClock();
  useKeyboardShortcuts();

  return (
    <div className="app">
      <div className="sel-strip">
        <div className="brand">BRAIN SWAP · GS-1</div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav${view === n.id ? " on" : ""}`}
            onClick={() => setView(n.id)}
          >
            {n.label}
          </button>
        ))}
        <div className="strip-space" />
        
      </div>
      {view === "console" && <Console />}
      {view === "report" && <ComplianceReport />}
      {view === "select" && <LevelSelect />}
      {view === "codex" && <MessageCodex />}
      {view === "help" && <Help />}
      <MobileGate />
      <WelcomeOverlay />
    </div>
  );
}
