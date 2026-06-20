// One message's reference block — name + direction + citation header, summary, and the
// field table (type / required / enum values). Extracted from MessageCodex so the same
// fidelity-policed reference can be embedded in the transition form's cheatsheet pane.
import { catalogEntry, type Direction, type MessageTypeName } from "@brain-swap/core";
import { Identifier } from "../ui/Identifier.tsx";

export const DIR_META: Record<Direction, { label: string; cls: string }> = {
  "MA->FA": { label: "MA → FA", cls: "ma" },
  "FA->MA": { label: "FA → MA", cls: "fa" },
  "MA->MS": { label: "MA → MS", cls: "ma" },
  "MS->MA": { label: "MS → MA", cls: "ms" },
};

export function MessageReference({ name }: { name: MessageTypeName }) {
  const m = catalogEntry(name);
  const { label, cls } = DIR_META[m.direction];
  return (
    <section className="codex-msg" id={`msg-${name}`}>
      <h2 className="codex-h">
        <Identifier name={name} />
        <span className={`codex-dir ${cls}`}>{label}</span>
        <span className="codex-cite">{m.citation}</span>
      </h2>
      <p className="help-p" style={{ margin: "6px 0" }}>
        {m.summary}
      </p>
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
              <td>
                <Identifier name={f.name} />
              </td>
              <td className="k-dim">{f.type}</td>
              <td>{f.required ? <span className="k-caution">✱</span> : ""}</td>
              <td>
                {f.values ? (
                  f.values.map((v, i) => (
                    <span key={v}>
                      {i > 0 ? " · " : ""}
                      <Identifier name={v} enumStyle="enum" />
                    </span>
                  ))
                ) : (
                  <span className="k-dim">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
