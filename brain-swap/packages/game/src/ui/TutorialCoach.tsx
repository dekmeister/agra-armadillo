// Coachmark tour for the tutorial level (0.0 "First Flight"). A short, non-modal
// sequence that highlights each console region in turn and ends by pointing at Play.
// Shown whenever a tutorial level is active (store.tutorial); dismissal is in-memory
// only (matching WelcomeOverlay), and the tour resets when the level changes so
// re-selecting 0.0 runs it again. Anchors are located by `data-tour` attributes and
// measured at runtime (getBoundingClientRect) so it stays robust to layout changes.
import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "../store.ts";

interface Step {
  readonly tour: string; // matches a data-tour="…" anchor
  readonly title: string;
  readonly body: string;
}

const STEPS: Step[] = [
  {
    tour: "telemetry",
    title: "1 · Telemetry",
    body: "Flight Autonomy's live stream, distilled. You are the MA brain — normally you'd read this and compose messages here. In this demo it's watch-only.",
  },
  {
    tour: "map",
    title: "2 · Tactical map",
    body: "The aircraft and its objective zone. Watch it acquire control, turn onto heading, and fly across to the zone.",
  },
  {
    tour: "mission",
    title: "3 · Mission & spec sheet",
    body: "Left: the mission card — your objective. Right: the body's spec sheet — its performance envelope, which FA publishes as a message on the bus (MA_FlightCapabilityMT), not a fixed manual page. Read against it, not against constants.",
  },
  {
    tour: "log",
    title: "4 · Message log",
    body: "Every MA↔FA message, tick by tick — the debugger for the whole exchange. Each send and reply lands here.",
  },
  {
    tour: "compose",
    title: "5 · Compose & Send",
    body: "When it's your turn, you act here. Composing pauses the clock while you build a message; it reaches FA the next tick. (Disabled in this watch-only demo.)",
  },
  {
    tour: "composer",
    title: "6 · The composer",
    body: "Pick an MA→FA message type, fill its real catalog fields (validated exactly as FA validates), and send. This is your only way to talk to the vehicle.",
  },
  {
    tour: "transport",
    title: "7 · Transport",
    body: "Play / Pause · Step · speed. Press ▶ Play to watch this mission solve itself, then hold at the zone for the win.",
  },
];

const RING_PAD = 6;
const POP_W = 280;
const GAP = 12;
const MARGIN = 8;

export function TutorialCoach() {
  const tutorial = useStore((s) => s.tutorial);
  const levelId = useStore((s) => s.level.id);

  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Reset the tour whenever the (tutorial) level changes, so re-selecting 0.0 reruns it.
  useEffect(() => {
    setStep(0);
    setDismissed(false);
  }, [levelId, tutorial]);

  const active = tutorial && !dismissed;
  const current = STEPS[step];

  // The "composer" step demonstrates the live message modal: open it on entry and
  // close it on leave (keyed on step so it doesn't fight other transitions). Compose
  // is otherwise disabled in tutorial mode, so this is the one place it appears.
  useEffect(() => {
    if (!active || STEPS[step]?.tour !== "composer") return;
    useStore.getState().openComposer();
    return () => useStore.getState().cancelComposer();
  }, [active, step]);

  // Measure the current step's anchor (and re-measure on resize/scroll).
  useLayoutEffect(() => {
    if (!active || !current) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${current.tour}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    // Re-measure shortly after mount — the Pixi map / panels can settle their size.
    const t = window.setTimeout(measure, 60);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearTimeout(t);
    };
  }, [active, current, step]);

  if (!active || !current) return null;

  const last = step === STEPS.length - 1;
  const close = () => setDismissed(true);

  // Position the popover under the anchor if there's room, else above; clamp to viewport.
  let popStyle: React.CSSProperties = { left: MARGIN, top: MARGIN };
  let ringStyle: React.CSSProperties | null = null;
  if (current.tour === "composer") {
    // The composer modal is screen-centered and self-highlighting; pin the coach
    // popover to the bottom so it stays put even as the modal renders over the page.
    popStyle = { left: "50%", bottom: 84, transform: "translateX(-50%)", width: POP_W };
  } else if (rect) {
    ringStyle = {
      left: rect.left - RING_PAD,
      top: rect.top - RING_PAD,
      width: rect.width + RING_PAD * 2,
      height: rect.height + RING_PAD * 2,
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.bottom + GAP;
    const placeBelow = below + 150 < vh;
    const top = placeBelow ? below : Math.max(MARGIN, rect.top - GAP - 150);
    let left = rect.left + rect.width / 2 - POP_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - POP_W - MARGIN));
    popStyle = { left, top, width: POP_W };
  }

  return (
    <div className="coach-layer">
      {ringStyle && <div className="coach-ring" style={ringStyle} />}
      <div className="coach-pop" style={popStyle} role="dialog" aria-label="Tutorial">
        <div className="coach-title">{current.title}</div>
        <p className="coach-body">{current.body}</p>
        <div className="coach-actions">
          <button className="btn ghost sm" onClick={close}>
            Skip
          </button>
          <div className="coach-nav">
            {step > 0 && (
              <button className="btn sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {last ? (
              <button className="btn sm on" onClick={close}>
                Got it
              </button>
            ) : (
              <button className="btn sm on" onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
        <div className="coach-dots">
          {STEPS.map((s, i) => (
            <span key={s.tour} className={`coach-dot${i === step ? " on" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
