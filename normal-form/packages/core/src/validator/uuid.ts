// Real RFC-4122 UUID checks for the CommandID field (V5/V6).
//   V5 · RQMT USTD-000436 — must be a Leach-Salz (variant 1) UUID or the nil UUID.
//   V6 · RQMT USTD-000673 — must be in canonical string form
//        xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (lowercase hex, hyphenated, no braces).

// Parseable as a UUID in any common presentation (any case, optional braces / urn).
const LOOSE =
  /^\{?(?:urn:uuid:)?([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})\}?$/;
// Canonical string representation (USTD-000673): lowercase, hyphenated, bare.
const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type UuidVerdict =
  | "ok"
  | "invalid" // not a UUID at all, or wrong variant → V5 (USTD-000436)
  | "noncanonical"; // a valid UUID but not in canonical string form → V6 (USTD-000673)

export function classifyUuid(value: string | null | undefined): UuidVerdict {
  if (!value) return "invalid";
  const s = value.trim();
  const m = LOOSE.exec(s);
  if (!m) return "invalid";

  const groups = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!];
  const isNil = groups.every((g) => /^0+$/.test(g));
  // Variant nibble = first hex digit of the 4th group. Leach-Salz (variant 1,
  // RFC 4122) ⇒ high bits 10xx ⇒ nibble ∈ {8,9,a,b}.
  const variantNibble = m[4]![0]!.toLowerCase();
  const leachSalz =
    variantNibble === "8" ||
    variantNibble === "9" ||
    variantNibble === "a" ||
    variantNibble === "b";
  if (!isNil && !leachSalz) return "invalid";

  return CANONICAL.test(s) ? "ok" : "noncanonical";
}
