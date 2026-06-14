// Help / How-to-play — a basic in-game README. Reachable from the selector strip.
import { useStore } from "../store.ts";
import { Identifier } from "../ui/Identifier.tsx";

export function Help() {
  const setView = useStore((s) => s.setView);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="screen">
      <div className="report">
        <div className="titleblock">
          <div className="formid">A-GRA VI · ASK 5.0a · GROUND STATION GS-1</div>
          <h1>HOW TO PLAY</h1>
          <div className="fields">
            <div>
              <span className="k">GENRE </span>
              <span className="v">Zachtronics-style programming puzzle</span>
            </div>
            <div>
              <span className="k">YOU ARE </span>
              <span className="v">a Mission Autonomy (MA) vendor</span>
            </div>
          </div>
        </div>

        <section>
          <h2>The idea</h2>
          <p className="help-p">
            You build a <b>brain</b> — a visual state machine — that talks to an aircraft's{" "}
            <b>Flight Autonomy (FA)</b> over the real A-GRA Vehicle Interface. FA always flies the
            aircraft; it only obeys you once you've properly acquired control, and it rejects
            anything outside the body's published performance envelope. Pick a mission from{" "}
            <span className="k-cyan">Level Select</span>; each level's <b>Mission Card</b> states
            its objective and win condition. The opening missions teach the control-acquisition
            handshake (<span className="k-cyan">1.1</span>) and your first valid flight command
            (<span className="k-cyan">1.2</span>); later ones add the performance envelope
            (<span className="k-cyan">1.3</span>), a hand-flown racetrack
            (<span className="k-cyan">1.4</span>), and re-flying one brain across airframes
            (<span className="k-cyan">4.1 / 4.5</span>).
          </p>
        </section>

        <section>
          <h2>The screen</h2>
          <ul className="help-ul">
            <li>
              <b>Brain Editor</b> (left) — your state machine. Build it in <b>EDIT</b> mode.
            </li>
            <li>
              <b>Tactical Map</b> (center) — top-down view: the aircraft, its trail, and the green
              objective zone(s) (a racetrack shows all of its waypoints). The altitude tape on the
              right shows commanded vs actual altitude.
            </li>
            <li>
              <b>Message Log</b> (right) — every message on the bus between MA and FA. This is your
              debugger. Click any row to inspect its payload and, for ignored/rejected messages, a
              "why?" explanation.
            </li>
            <li>
              <b>Mission Card / Body Spec Sheet</b> — the objective and the body's advertised
              capability envelope (the numbers FA validates against).
            </li>
            <li>
              <b>Status strip</b> — your four scores (<span className="k-dim">Ticks · Bus Traffic ·
              Rejections · Brain Size</span>) versus the level par.
            </li>
          </ul>
        </section>

        <section>
          <h2>EDIT vs RUN</h2>
          <p className="help-p">
            Toggle the <span className="k-cyan">EDIT</span> /{" "}
            <span className="k-green">RUN</span> switch (top right). In <b>EDIT</b> you build the
            brain; in <b>RUN</b> the deterministic simulation plays from tick 0 and the active
            brain state lights up green. Use play / pause / step and the 1× / 2× / 8× speeds.
            Click a log row to scrub the inspector; the run always re-simulates from the start, so
            it's perfectly repeatable.
          </p>
        </section>

        <section>
          <h2>Building the brain</h2>
          <ul className="help-ul">
            <li>
              <b>+ State</b> adds a state. Select one to <b>Rename</b>, <b>Delete</b>, or{" "}
              <b>Set Initial</b> (the cyan-dotted starting state).
            </li>
            <li>
              <b>Drag from one state's handle to another</b> to create a transition, then select
              the edge to edit it in the <b>Transition</b> panel.
            </li>
            <li>
              A transition fires on a <b>trigger</b> (an incoming message type) with an optional{" "}
              <b>guard</b> (one field condition, e.g.{" "}
              <span className="k-amber">ApprovalRequestProcessingState == APPROVED</span>), runs a{" "}
              <b>send action</b>, and <b>goes to</b> a target state.
            </li>
            <li>
              In the <b>Send Action</b> form, each field's value comes from one of three sources:{" "}
              <span className="k-amber">LIT</span> (a literal),{" "}
              <span className="k-cyan">CAP</span> (a body capability, e.g.{" "}
              <span className="k-cyan">cap.CapabilityID</span>), or{" "}
              <span className="k-amber">MSG</span> (a field captured from the triggering message).
            </li>
          </ul>
        </section>

        <section>
          <h2>Keyboard shortcuts</h2>
          <table className="help-keys">
            <tbody>
              <tr><td><kbd>Space</kbd></td><td>Play / Pause — if in Edit mode, switches to Run and starts</td></tr>
              <tr><td><kbd>S</kbd></td><td>Stop — rewind to tick 0 and pause (Run mode)</td></tr>
              <tr><td><kbd>→</kbd></td><td>Step forward one tick (Run mode)</td></tr>
              <tr><td><kbd>1</kbd></td><td>1× speed</td></tr>
              <tr><td><kbd>2</kbd></td><td>2× speed</td></tr>
              <tr><td><kbd>3</kbd></td><td>8× speed</td></tr>
              <tr><td><kbd>E</kbd></td><td>Switch to Edit mode</td></tr>
              <tr><td><kbd>R</kbd></td><td>Switch to Run mode</td></tr>
            </tbody>
          </table>
          <p className="help-p k-dim">Shortcuts are disabled while the cursor is in a text field.</p>
        </section>

        <section>
          <h2>The core lesson (the handshake)</h2>
          <p className="help-p">
            Every mission starts the same way: FA isn't listening until you hold control. Send a{" "}
            <Identifier name="MA_FlightCommandMT" /> too early and the log shows{" "}
            <span className="k-olive">IGNORED — not secondary controller</span>. The correct
            sequence:
          </p>
          <ol className="help-ol">
            <li>
              Wait for <Identifier name="MA_FlightCapabilityStatusMT" /> with{" "}
              <span className="k-amber">Availability == AVAILABLE</span>.
            </li>
            <li>
              Send <Identifier name="MA_ControlRequestMT" /> with{" "}
              <span className="k-amber">RequestType ACQUIRE</span> and the right{" "}
              <span className="k-cyan">CapabilityID</span>.
            </li>
            <li>
              Wait for <Identifier name="MA_ControlRequestStatusMT" />{" "}
              <span className="k-amber">APPROVED</span>, then confirm you appear as{" "}
              <span className="k-amber">SecondaryController</span> in the next{" "}
              <Identifier name="ControlStatusMT" />.
            </li>
            <li>
              Now send <Identifier name="MA_FlightCommandMT" /> (heading / altitude / speed). Keep
              values inside the spec sheet's envelope or FA rejects with{" "}
              <Identifier name="PERFORMANCE_LIMIT_EXCEEDED" enumStyle="bad" />.
            </li>
            <li>
              Watch <Identifier name="MA_PositionReportDetailedMT" /> to know when you've reached
              the zone, then slow down and hold.
            </li>
          </ol>
          <p className="help-p k-dim">
            Stuck? In EDIT mode press <b>Reference</b> to load a worked solution, switch to RUN to
            watch it fly, then study the log — or <b>Reset</b> and build your own.
          </p>
        </section>

        <div className="rfoot">
          <span className="cert">Fidelity Notes (bottom-center on the console) state exactly what is simplified vs ASK 5.0a.<br /><a href="https://github.com/dekmeister/agra-armadillo" target="_blank" rel="noopener noreferrer">github.com/dekmeister/agra-armadillo</a></span>
          <div className="right">
            <button className="btn" onClick={() => { setView("console"); setMode("EDIT"); }}>
              Go to Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
