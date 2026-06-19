// Primary console: ChromeBar + StatusStrip + the 3-column grid, with fluid side columns
// (clamp(380,28vw,560) | 1fr | clamp(310,24vw,386)) so it fits down to a 1180px tablet.
// Realtime mode: left = live FA telemetry + the Compose affordance (you are the MA brain);
// center = map + mission/spec; right = the message-log debugger. The composer modal opens
// over everything while the player is composing a message (the clock is paused then).
import { useState } from "react";
import { MessageLogPanel } from "../run/MessageLog.tsx";
import { BodySpecSheet, MissionCard } from "../run/MissionPanels.tsx";
import { TacticalMapPanel } from "../run/TacticalMap.tsx";
import { useStore } from "../store.ts";
import { ChromeBar } from "./ChromeBar.tsx";
import { MessageComposer } from "./MessageComposer.tsx";
import { MsPanel } from "./MsPanel.tsx";
import { StatusStrip } from "./StatusStrip.tsx";
import { TelemetryPanel } from "./TelemetryPanel.tsx";

/** Short viewports (landscape tablets ~820px tall) can't fit the map plus both expanded
 * cards, so the cards start collapsed there to keep the map usable. Desktop stays expanded. */
function shortViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-height: 860px)").matches;
}

export function Console() {
  // Mission card + body spec sheet share one collapse state so they fold/unfold together.
  const [panelsOpen, setPanelsOpen] = useState(() => !shortViewport());
  const togglePanels = () => setPanelsOpen((o) => !o);
  const composing = useStore((s) => s.composing);
  return (
    <>
      <ChromeBar />
      <StatusStrip />
      <div className="grid">
        <div className="col" data-tour="telemetry">
          <TelemetryPanel />
          <MsPanel />
        </div>
        <div className="col">
          <TacticalMapPanel />
          <div
            data-tour="mission"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <MissionCard collapsed={!panelsOpen} onToggleCollapse={togglePanels} />
            <BodySpecSheet collapsed={!panelsOpen} onToggleCollapse={togglePanels} />
          </div>
        </div>
        <div className="col" data-tour="log">
          <MessageLogPanel />
        </div>
      </div>
      {composing && <MessageComposer />}
    </>
  );
}
