// The compose-gate findings for the sheet's current (S4: initial, non-editable)
// composition. Reuses the real S3 validator so the inspector field errors and the
// validator console quote the standard verbatim from one source. Keyed on the
// wired machine: with `?ref=1` the reference machine satisfies V10 (READY gate),
// leaving exactly the two scripted envelope beats (SystemID + CommandID).
import { type Finding, initialComposition, validate } from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { useMemo } from "react";
import { useGameStore } from "./store.ts";

export function useFindings(): Finding[] {
  const machine = useGameStore((s) => s.machine);
  return useMemo(
    () => validate(sheet_1_1, initialComposition(sheet_1_1, machine ?? undefined)),
    [machine],
  );
}
