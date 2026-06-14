// Mobile gate. The console is a dense desktop avionics workspace (React Flow drag-wiring,
// three heavyweight panels) and isn't usable on a phone/tablet. Detect a small or
// coarse-pointer viewport and show a blocking notice (with a "continue anyway" escape).
import { useEffect, useState } from "react";

/** Treat as "mobile" when the viewport is narrow OR the primary pointer is coarse (touch). */
function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia("(max-width: 1024px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return narrow || coarse;
}

export function MobileGate() {
  const [isMobile, setIsMobile] = useState(detectMobile);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(detectMobile());
    const mq = window.matchMedia("(max-width: 1024px)");
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!isMobile || dismissed) return null;

  return (
    <div className="mobile-gate">
      <div className="mobile-card">
        <div className="mg-brand">BRAIN SWAP · GS-1</div>
        <h2>Desktop required</h2>
        <p>
          This is a dense MIL-spec ground-station console — you wire a state machine by dragging
          on a graph canvas across three side-by-side panels. It needs a mouse/trackpad and a wide
          screen, so it isn't playable on a phone or small tablet.
        </p>
        <p className="mg-dim">Open it on a desktop browser at 1280px wide or more.</p>
        <button className="btn" onClick={() => setDismissed(true)}>
          Continue anyway
        </button>
      </div>
    </div>
  );
}
