// First-visit welcome card. Greets a fresh visitor, explains in one breath what Brain
// Swap is and how to start, then gets out of the way. Dismissal is in-memory only — per
// the product call we deliberately use NO cookies/localStorage, so it reappears on a full
// reload. That's an accepted trade-off for now (see the task brief).
import { useState } from "react";
import { useStore } from "../store.ts";

export function WelcomeOverlay() {
  const setView = useStore((s) => s.setView);
  const selectLevel = useStore((s) => s.selectLevel);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const go = (view: "select" | "help") => {
    setView(view);
    setDismissed(true);
  };

  const startTutorial = () => {
    selectLevel("0.0"); // routes to the console; the coachmark tour appears there
    setDismissed(true);
  };

  return (
    <div className="welcome-gate" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="mobile-card welcome-card">
        <div className="mg-brand">BRAIN SWAP · GS-1</div>
        <h2 id="welcome-title">Welcome, operator</h2>
        <p>
          This is a realtime protocol puzzle. <b>You are the Mission Autonomy (MA) brain:</b> an
          aircraft's Flight Autonomy publishes a live message stream, and you read it and send
          messages back — by hand, tick by tick — over the real A-GRA Vehicle Interface.
        </p>
        <p className="mg-dim">
          To get started: pick a mission from <b>Level Select</b>, then press <b>Play</b> and{" "}
          <b>Compose</b> to send your first message. The clock pauses while you type. New here? The{" "}
          <b>Help</b> page walks through the control-acquisition handshake step by step.
        </p>
        <div className="welcome-actions">
          <button type="button" className="btn big on" onClick={startTutorial}>
            Start tutorial
          </button>
          <button type="button" className="btn big" onClick={() => go("select")}>
            Pick a mission
          </button>
          <button type="button" className="btn" onClick={() => go("help")}>
            How to play
          </button>
          <button type="button" className="btn ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
