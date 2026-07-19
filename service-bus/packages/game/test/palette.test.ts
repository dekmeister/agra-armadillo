/**
 * The interface-class encoding (WP4.3).
 *
 * The point of this file is the reserved-role assertion: before WP4, amber carried four
 * unrelated meanings at once (BAD link, FAIL_MISSING_ACK, MD tokens, hot queue badge) and
 * MP sat in the colour `tokens.css` reserves for the authority seal. Those collisions came
 * back as a *board* bug — on Phase 5, amber MD tokens swarmed beside amber count badges
 * during an amber-accented beat. Enforcing it here means it cannot silently regress.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLASS_DESC, CLASS_FILL, CLASSES, RESERVED_ROLES, SHAPE } from "../src/lib/palette.ts";

const SRC = join(import.meta.dirname, "../src");
const tokensCss = readFileSync(join(SRC, "styles/tokens.css"), "utf8");
const legend = readFileSync(join(SRC, "components/Legend.svelte"), "utf8");

describe("interface-class palette", () => {
  it("covers all six L1 classes", () => {
    expect(CLASSES).toEqual(["C2", "P2P", "VI", "MS", "MD", "MP"]);
    for (const c of CLASSES) {
      expect(CLASS_FILL[c], `${c} has no fill`).toBeTruthy();
      expect(SHAPE[c], `${c} has no shape`).toBeTruthy();
      expect(CLASS_DESC[c], `${c} has no gloss`).toBeTruthy();
    }
  });

  it("never reuses a colour that carries a non-class meaning", () => {
    for (const c of CLASSES) {
      for (const role of RESERVED_ROLES) {
        expect(
          CLASS_FILL[c],
          `${c} reuses ${role}, which means something other than "class"`,
        ).not.toBe(`var(${role})`);
      }
    }
  });

  it("gives every class its own distinct hue", () => {
    const fills = CLASSES.map((c) => CLASS_FILL[c]);
    expect(new Set(fills).size, "two classes share a colour").toBe(CLASSES.length);
  });

  it("defines every class colour in tokens.css", () => {
    for (const c of CLASSES) {
      const v = /var\((--[a-z0-9-]+)\)/.exec(CLASS_FILL[c] ?? "")?.[1];
      expect(v, `${c} fill is not a CSS custom property`).toBeTruthy();
      expect(tokensCss, `${v} is not defined in tokens.css`).toContain(`${v}:`);
    }
  });

  it("keeps the legend in step with what the board draws", () => {
    // Legend.svelte iterates CLASSES, so class coverage is structural; this guards the
    // remaining hand-written entries against the board growing a vocabulary it omits.
    for (const token of ["--mesh-fill", "--mesh-fill-clean", "--ms-rail", "--gold", "--amber"]) {
      expect(legend, `legend never mentions ${token}`).toContain(token);
    }
    for (const term of ["on-platform", "DMS port", "LEADER", "authority", "REROUTED"]) {
      expect(legend, `legend never explains "${term}"`).toContain(term);
    }
  });
});
