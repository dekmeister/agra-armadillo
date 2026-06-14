// App shell: the secondary-screen selector strip + view routing, plus the single rAF
// loop that drives the deterministic sim. The clock (performance.now / rAF) lives ONLY
// here — the core stays headless (CLAUDE.md rule #3). Playback advances the playhead into
// the precomputed timeline; it never calls step() directly.
import { useEffect, useRef } from "react";
import { useStore, type View } from "./store.ts";
import { Console } from "./console/Console.tsx";
import { ComplianceReport } from "./meta/ComplianceReport.tsx";
import { LevelSelect } from "./meta/LevelSelect.tsx";
import { Help } from "./meta/Help.tsx";
import { MessageCodex } from "./meta/MessageCodex.tsx";
import { MobileGate } from "./ui/MobileGate.tsx";

/** Ticks advanced per real second at 1× speed. 2×/8× scale this. */
const TICKS_PER_SECOND = 4;

function usePlaybackClock() {
  const running = useStore((s) => s.running);
  const speed = useStore((s) => s.speed);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tps = TICKS_PER_SECOND * speed;
    recordedRef.current = false;

    const loop = (now: number) => {
      acc += (now - last) / 1000;
      last = now;
      const advance = Math.floor(acc * tps);
      if (advance > 0) {
        acc -= advance / tps;
        const st = useStore.getState();
        const target = st.playhead + advance;
        st.scrubTo(target);
        // Record the result once when the run reaches its terminal frame.
        if (target >= st.timeline.length - 1 && !recordedRef.current) {
          recordedRef.current = true;
          st.recordResult();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);
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
        <div className="strip-meta">A-GRA VI · ASK 5.0a · MIL-SPEC GROUND STATION</div>
      </div>
      {view === "console" && <Console />}
      {view === "report" && <ComplianceReport />}
      {view === "select" && <LevelSelect />}
      {view === "codex" && <MessageCodex />}
      {view === "help" && <Help />}
      <MobileGate />
    </div>
  );
}
