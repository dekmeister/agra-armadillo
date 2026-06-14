// Mobile gate. The console is a dense avionics workspace (React Flow wiring, three
// side-by-side panels) and needs ~1180px of width to lay out without squashing the map.
// It supports landscape tablets (e.g. iPad Pro 11" at 1180×820), so we gate purely on
// width — not pointer type — and show a blocking notice (with a "continue anyway" escape).
import { useEffect, useState } from "react";

/** Treat as "too small" when the viewport is narrower than the 1180px layout floor. */
function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1179px)").matches;
}

export function MobileGate() {
  const [isMobile, setIsMobile] = useState(detectMobile);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(detectMobile());
    const mq = window.matchMedia("(max-width: 1179px)");
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
        <h2>Screen too narrow</h2>
        <p>
          Brain Swap needs a wide screen for its editor. Open it on a landscape tablet or
          any desktop browser.
        </p>
        <button className="btn" onClick={() => setDismissed(true)}>
          Continue anyway
        </button>
      </div>
    </div>
  );
}
