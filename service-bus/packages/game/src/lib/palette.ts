/**
 * The interface-class encoding: one dedicated hue per L1 class, plus the token shape.
 *
 * Single source of truth for BOTH the board (`Graph.svelte`) and the key
 * (`Legend.svelte`), so the legend cannot drift from what is actually drawn — the same
 * anti-drift discipline `codex.ts` applies to message names.
 *
 * WP4 (`PLAN_REVIEW.md` §WP4.3): before this module, VI/MS/MD/MP borrowed *semantic*
 * tokens — VI reused `--good` (the healthy-rail grey, so a VI token was the same colour
 * as a rail), MS reused `--sub` (muted text), MD reused `--amber` and MP reused `--gold`.
 * That put amber on four unrelated meanings at once (BAD link, FAIL_MISSING_ACK, MD
 * tokens, hot queue badge) and put MP in the colour `tokens.css` reserves for the
 * authority seal. Amber is now degradation and nothing else.
 *
 * [S] The colour/shape taxonomy is a game legend, not an A-GRA artefact — see
 * `docs/01-mechanics-to-agra-mapping.md` item 25. The *class assignment* is real.
 */
import type { InterfaceClass } from "@service-bus/core";

/** Every interface class, in curriculum order (C2/P2P first — the MVP pair). */
export const CLASSES: InterfaceClass[] = ["C2", "P2P", "VI", "MS", "MD", "MP"];

/**
 * Colour roles that carry a NON-class meaning and must never be reused as a class fill.
 * `palette.test.ts` asserts `CLASS_FILL` contains none of these, so "amber is reserved
 * for degradation" cannot silently regress.
 */
export const RESERVED_ROLES = ["--amber", "--bad", "--red", "--green", "--gold", "--good", "--sub"];

/** Token fill by interface class. */
export const CLASS_FILL: Record<InterfaceClass, string> = {
  C2: "var(--c2)",
  P2P: "var(--p2p)",
  VI: "var(--vi)",
  MS: "var(--ms)",
  MD: "var(--md)",
  MP: "var(--mp)",
};

// Square = C2 command; every other interface class reads as a circle (colour carries
// the class). Shape is deliberately NOT split further — hue is the class axis here.
export const SHAPE: Record<InterfaceClass, "square" | "circle"> = {
  C2: "square",
  P2P: "circle",
  VI: "circle",
  MS: "circle",
  MD: "circle",
  MP: "circle",
};

/** One-line gloss per class, for the legend. */
export const CLASS_DESC: Record<InterfaceClass, string> = {
  C2: "command",
  P2P: "peer",
  VI: "on-platform",
  MS: "mission-sys",
  MD: "mission-data",
  MP: "mission-plan",
};
