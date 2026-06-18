// Help / How-to-play — a basic in-game README. Reachable from the selector strip.
import { useStore } from "../store.ts";
import { Identifier } from "../ui/Identifier.tsx";

export function Help() {
  const setView = useStore((s) => s.setView);

  return (
    <div className="screen">
      <div className="report">
        <div className="titleblock">
          <div className="formid">A-GRA VI · ASK 5.0a · GROUND STATION GS-1</div>
          <h1>HOW TO PLAY</h1>
          <div className="fields">
            <div>
              <span className="k">GENRE </span>
              <span className="v">Realtime protocol puzzle</span>
            </div>
            <div>
              <span className="k">YOU ARE </span>
              <span className="v">the Mission Autonomy (MA) brain</span>
            </div>
          </div>
        </div>

        <section>
          <h2>The idea</h2>
          <p className="help-p">
            You <b>are</b> the Mission Autonomy brain. An aircraft's <b>Flight Autonomy (FA)</b>{" "}
            publishes a live stream of messages over the real A-GRA Vehicle Interface; you read it
            and send messages back, by hand, in (semi-)realtime. FA always flies the aircraft — it
            only obeys you once you've properly acquired control, and it rejects anything outside
            the body's published performance envelope. Pick a mission from{" "}
            <span className="k-cyan">Level Select</span>; each level's <b>Mission Card</b> states
            its objective and win condition. The opening missions teach the control-acquisition
            handshake (<span className="k-cyan">1.1</span>) and your first valid flight command (
            <span className="k-cyan">1.2</span>); later ones add the performance envelope (
            <span className="k-cyan">1.3</span>), a hand-flown racetrack (
            <span className="k-cyan">1.4</span>), and re-flying one brain across airframes (
            <span className="k-cyan">4.5</span>).
          </p>
        </section>

        <section>
          <h2>The screen</h2>
          <ul className="help-ul">
            <li>
              <b>Telemetry</b> (left) — the latest value of each thing FA has told you (capability
              availability, your control authority, last command result, position/activity) plus the
              live objective-hold progress. This is your at-a-glance instrument panel. The big{" "}
              <b>Compose &amp; Send</b> button is here.
            </li>
            <li>
              <b>Tactical Map</b> (center) — top-down view: the aircraft, its trail, and the green
              objective zone(s). The altitude tape on the right shows commanded vs actual altitude.
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
              <b>Status strip</b> — your three scores (
              <span className="k-dim">Ticks · Bus Traffic · Rejections</span>) versus the level par.
            </li>
          </ul>
        </section>

        <section>
          <h2>Flying it</h2>
          <p className="help-p">
            Press <span className="k-green">Play</span> and the simulation runs forward one tick at
            a time. When you want to act, press <span className="k-cyan">Compose</span> (the clock
            pauses while you type) — first pick the message type, then fill its fields, then{" "}
            <b>Send</b>. Your message reaches FA the <b>next</b> tick, and FA's reply comes the tick
            after that, so plan for the round-trip. Use <b>Restart</b> to start the mission over and{" "}
            <b>Step</b> to advance a single tick. The run is deterministic: the same inputs always
            produce the same result.
          </p>
        </section>

        <section>
          <h2>Keyboard shortcuts</h2>
          <table className="help-keys">
            <tbody>
              <tr>
                <td>
                  <kbd>Space</kbd>
                </td>
                <td>Play / Pause</td>
              </tr>
              <tr>
                <td>
                  <kbd>C</kbd>
                </td>
                <td>Compose &amp; send a message (pauses the clock)</td>
              </tr>
              <tr>
                <td>
                  <kbd>→</kbd>
                </td>
                <td>Step forward one tick</td>
              </tr>
              <tr>
                <td>
                  <kbd>R</kbd>
                </td>
                <td>Restart the mission</td>
              </tr>
              <tr>
                <td>
                  <kbd>1</kbd>
                </td>
                <td>1× speed</td>
              </tr>
              <tr>
                <td>
                  <kbd>2</kbd>
                </td>
                <td>2× speed</td>
              </tr>
              <tr>
                <td>
                  <kbd>3</kbd>
                </td>
                <td>8× speed</td>
              </tr>
            </tbody>
          </table>
          <p className="help-p k-dim">
            Shortcuts are disabled while the cursor is in a text field.
          </p>
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
              <span className="k-amber">Availability == AVAILABLE</span> (the Telemetry panel shows
              it).
            </li>
            <li>
              Send <Identifier name="MA_ControlRequestMT" /> with{" "}
              <span className="k-amber">RequestType ACQUIRE</span> and the right{" "}
              <span className="k-cyan">CapabilityID</span>.
            </li>
            <li>
              Wait for <Identifier name="MA_ControlRequestStatusMT" />{" "}
              <span className="k-amber">APPROVED</span>, then confirm <b>Authority</b> reads{" "}
              <span className="k-amber">SECONDARY (you)</span>.
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
        </section>

        <div className="rfoot">
          <span className="cert">
            Fidelity Notes (bottom-center on the console) state exactly what is simplified vs ASK
            5.0a.
            <br />
            <a
              href="https://github.com/dekmeister/agra-armadillo"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/dekmeister/agra-armadillo
            </a>
          </span>
          <div className="right">
            <button type="button" className="btn" onClick={() => setView("console")}>
              Go to Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
