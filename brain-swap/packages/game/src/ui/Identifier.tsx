// The Identifier primitive (handoff "two tweaks", #1). Every long A-GRA identifier
// renders through this component so the semantic core reads first: a dim `MA_` prefix
// and `MT` suffix, a bright core, and enum literals colored amber (or caution for a
// failed validation result, cyan for a cap.* / reference). It is the ONLY way message
// and field identifiers are rendered (handoff: "no truncation of identifiers, ever").

export type EnumStyle = "enum" | "bad" | "ref";

export function Identifier({ name, enumStyle }: { name?: string; enumStyle?: EnumStyle }) {
  // Defensive: never crash the tree on a missing identifier (renders nothing instead).
  if (!name) return null;
  if (enumStyle) return <span className={`id-enum ${enumStyle}`}>{name}</span>;
  const pfx = name.startsWith("MA_") ? "MA_" : "";
  const sfx = name.endsWith("MT") ? "MT" : "";
  const core = name.slice(pfx.length, name.length - (sfx.length || 0));
  return (
    <span className="id">
      {pfx && <span className="id-pfx">{pfx}</span>}
      <span className="id-core">{core}</span>
      {sfx && <span className="id-sfx">{sfx}</span>}
    </span>
  );
}
