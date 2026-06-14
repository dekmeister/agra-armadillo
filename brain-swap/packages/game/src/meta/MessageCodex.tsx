// Message Codex — an in-game reference for every Tier-1 message a transition can trigger
// on or send. Bound directly to MESSAGE_CATALOG (the generated, fidelity-policed catalog),
// so it can never drift from what the player actually wires. Lets players learn the VI
// messages without leaving the game.
import { MESSAGE_TYPE_NAMES } from "@brain-swap/core";
import { MessageReference } from "./MessageReference.tsx";

export function MessageCodex() {
  return (
    <div className="screen">
      <div className="report codex">
        <div className="titleblock">
          <div className="formid">A-GRA VI · ASK 5.0a · TIER-1 MESSAGE CATALOG</div>
          <h1>MESSAGE CODEX</h1>
          <div className="fields">
            <div>
              <span className="k">DIRECTION </span>
              <span className="v">
                <span className="k-cyan">MA→FA</span> = you send · <span className="k-amber">FA→MA</span> = you receive
              </span>
            </div>
            <div>
              <span className="k">FIELDS </span>
              <span className="v">✱ = required in this interaction</span>
            </div>
          </div>
        </div>

        {MESSAGE_TYPE_NAMES.map((name) => <MessageReference key={name} name={name} />)}
      </div>
    </div>
  );
}
