// The static validator (compose gate). See validate.ts for the V1–V10 battery.
import type { Sheet } from "../level/types.ts";
import type { Machine } from "../machine/schema.ts";
import type { Composition } from "./types.ts";

export * from "./types.ts";
export * from "./uuid.ts";
export * from "./validate.ts";

/** Build the composition the sheet starts in: the placed Command-2, its binding,
 *  both roles bound to their lifelines, the pre-filled (deliberately broken)
 *  fields, and the wired handler machine. The two scripted beats fall out of the
 *  broken initial fields. */
export function initialComposition(sheet: Sheet, machine?: Machine): Composition {
  const primary = sheet.palette.find((p) => p.unlocked);
  const binding = primary?.binding ?? { request: "", response: "" };
  const commander = sheet.lifelines.find((l) => l.player)?.id ?? null;
  const commandee = sheet.lifelines.find((l) => !l.player)?.id ?? null;
  return {
    pattern: primary?.pattern ?? "",
    binding,
    roles: { commander, commandee },
    fields: sheet.compose.initialFields,
    ...(machine ? { machine } : {}),
  };
}
