// Message Codex — an in-game reference for every Tier-1 message a transition can trigger
// on or send. Bound directly to MESSAGE_CATALOG (the generated, fidelity-policed catalog),
// so it can never drift from what the player actually wires. Lets players learn the VI
// messages without leaving the game.
import { catalogEntry, MESSAGE_TYPE_NAMES } from "@brain-swap/core";
import { Identifier } from "../ui/Identifier.tsx";

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

        {MESSAGE_TYPE_NAMES.map((name) => {
          const m = catalogEntry(name);
          const toMA = m.direction === "FA->MA";
          return (
            <section key={name} className="codex-msg">
              <h2 className="codex-h">
                <Identifier name={name} />
                <span className={`codex-dir ${toMA ? "fa" : "ma"}`}>{toMA ? "FA → MA" : "MA → FA"}</span>
                <span className="codex-cite">{m.citation}</span>
              </h2>
              <p className="help-p" style={{ margin: "6px 0" }}>{m.summary}</p>
              <table className="itable">
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Field</th>
                    <th style={{ width: 70 }}>Type</th>
                    <th style={{ width: 40 }}>Req</th>
                    <th>Values</th>
                  </tr>
                </thead>
                <tbody>
                  {m.fields.map((f) => (
                    <tr key={f.name}>
                      <td><Identifier name={f.name} /></td>
                      <td className="k-dim">{f.type}</td>
                      <td>{f.required ? <span className="k-caution">✱</span> : ""}</td>
                      <td>
                        {f.values
                          ? f.values.map((v, i) => (
                              <span key={v}>
                                {i > 0 ? " · " : ""}
                                <Identifier name={v} enumStyle="enum" />
                              </span>
                            ))
                          : <span className="k-dim">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
