// The compose-gate findings for the player's current session. Reuses the real S3
// validator (via the core session builder) so the inspector field errors and the
// validator console quote the standard verbatim from one source, live as the
// player edits.
import { buildComposition, type Finding, validate } from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { useMemo } from "react";
import { useGameStore } from "./store.ts";

export function useFindings(): Finding[] {
  const session = useGameStore((s) => s.session);
  return useMemo(() => validate(sheet_1_1, buildComposition(sheet_1_1, session)), [session]);
}
