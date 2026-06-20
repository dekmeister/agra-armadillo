// Message Codex — an in-game reference for every message a player can send or receive.
// Bound directly to MESSAGE_CATALOG (the generated, fidelity-policed catalog),
// so it can never drift from what the player actually wires. Lets players learn the VI
// messages without leaving the game.
import {
  catalogEntry,
  type Direction,
  MESSAGE_TYPE_NAMES,
  type MessageTypeName,
} from "@brain-swap/core";
import { DIR_META, MessageReference } from "./MessageReference.tsx";

function scrollTo(name: string) {
  document.getElementById(`msg-${name}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function MessageCodex() {
  const byDir = new Map<Direction, MessageTypeName[]>();
  for (const name of MESSAGE_TYPE_NAMES) {
    const d = catalogEntry(name).direction;
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d)!.push(name);
  }

  return (
    <div className="screen">
      <div className="report codex">
        <div className="titleblock">
          <div className="formid">A-GRA VI · ASK 5.0a · MESSAGE CATALOG</div>
          <h1>MESSAGE CODEX</h1>
          <div className="fields">
            <div>
              <span className="k">DIRECTION </span>
              <span className="v">
                <span className="k-cyan">MA→FA</span> = you send ·{" "}
                <span className="k-amber">FA→MA</span> = you receive (FA)
              </span>
            </div>
            <div>
              <span className="k">          </span>
              <span className="v">
                <span className="k-cyan">MA→MS</span> = you send ·{" "}
                <span className="k-green">MS→MA</span> = you receive (MS)
              </span>
            </div>
            <div>
              <span className="k">FIELDS </span>
              <span className="v">✱ = required in this interaction</span>
            </div>
          </div>
        </div>

        <h2>MESSAGE INDEX</h2>
        <nav className="codex-idx">
          {(["MA->FA", "FA->MA", "MA->MS", "MS->MA"] as const).map((dir) => {
            const msgs = byDir.get(dir);
            if (!msgs || msgs.length === 0) return null;
            const { label, cls } = DIR_META[dir];
            return (
              <div key={dir} className="codex-idx-group">
                <div className={`codex-dir ${cls}`}>{label}</div>
                {msgs.map((n) => (
                  <a
                    key={n}
                    href={`#msg-${n}`}
                    className="codex-idx-link"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo(n);
                    }}
                  >
                    {catalogEntry(n).name}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>

        <h2>MESSAGES DETAIL</h2>
        {MESSAGE_TYPE_NAMES.map((name) => (
          <MessageReference key={name} name={name} />
        ))}
      </div>
    </div>
  );
}
