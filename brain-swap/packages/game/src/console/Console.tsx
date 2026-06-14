// Primary console: ChromeBar + StatusStrip + the 3-column grid, with fluid side columns
// (clamp(380,28vw,560) | 1fr | clamp(310,24vw,386)) so it fits down to a 1180px tablet.
// Left = brain editor (full height); center = map + mission/spec + transition form; right = log pillar.
import { useState } from "react";
import { ChromeBar } from "./ChromeBar.tsx";
import { StatusStrip } from "./StatusStrip.tsx";
import { BrainEditorPanel } from "../editor/BrainEditorPanel.tsx";
import { TransitionForm } from "../editor/TransitionForm.tsx";
import { TacticalMapPanel } from "../run/TacticalMap.tsx";
import { MissionCard, BodySpecSheet } from "../run/MissionPanels.tsx";
import { MessageLogPanel } from "../run/MessageLog.tsx";

/** Short viewports (landscape tablets ~820px tall) can't fit the map plus both expanded
 * cards plus the transition form, so the cards start collapsed there to keep the map and
 * the (deliberately tall) transition form usable. Desktop stays fully expanded. */
function shortViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-height: 860px)").matches;
}

export function Console() {
  // Mission card + body spec sheet share one collapse state so they fold/unfold together.
  // Open by default on desktop; collapsed on start for short screens (see above). Local to
  // the layout — no persistence needed.
  const [panelsOpen, setPanelsOpen] = useState(() => !shortViewport());
  const togglePanels = () => setPanelsOpen((o) => !o);
  return (
    <>
      <ChromeBar />
      <StatusStrip />
      <div className="grid">
        <div className="col">
          <BrainEditorPanel />
        </div>
        <div className="col">
          <TacticalMapPanel />
          {/* The map keeps priority (it has a min-height floor in CSS); the cards yield to
              the squeeze. minHeight:0 + overflow:hidden mean a constrained BODY card clips
              inside its box instead of spilling its rows out as floating text. On short
              screens the cards start collapsed, so they just show their "BODY ▸" header. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minHeight: 0, overflow: "hidden" }}>
            <MissionCard collapsed={!panelsOpen} onToggleCollapse={togglePanels} />
            <BodySpecSheet collapsed={!panelsOpen} onToggleCollapse={togglePanels} />
          </div>
          <TransitionForm />
        </div>
        <div className="col">
          <MessageLogPanel />
        </div>
      </div>
    </>
  );
}
