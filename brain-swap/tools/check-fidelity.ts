// Fidelity gate CLI (build-order step 1, CLAUDE.md hard rule #1).
//
// Verifies every catalog message/field/enum name appears verbatim in the A-GRA XSD.
// House style: machine-readable TSV to stdout, human summary to stderr, non-zero exit
// on failure (mirrors Utility/ServerChecks conventions).
//
// Usage: tsx tools/check-fidelity.ts [path-to-xsd]
//        FIDELITY_XSD=/path/to.xsd tsx tools/check-fidelity.ts
import { existsSync } from "node:fs";
import { DEFAULT_XSD_PATH } from "./catalog-source.ts";
import { findOffenders } from "./fidelity.ts";

function main(): void {
  const xsdPath = process.argv[2] ?? process.env.FIDELITY_XSD ?? DEFAULT_XSD_PATH;
  if (!existsSync(xsdPath)) {
    process.stderr.write(`check-fidelity: XSD not found at ${xsdPath}\n`);
    process.exit(2);
  }

  const { offenders, checked } = findOffenders(xsdPath);

  const seen = new Set<string>();
  for (const t of offenders) {
    const key = `${t.kind}\t${t.value}\t${t.owner}`;
    if (seen.has(key)) continue;
    seen.add(key);
    process.stdout.write(`FAIL\t${t.kind}\t${t.value}\t${t.owner}\n`);
  }

  if (offenders.length > 0) {
    const distinct = new Set(offenders.map((t) => t.value)).size;
    process.stderr.write(
      `check-fidelity: FAIL — ${distinct} invented name(s) not found in ${xsdPath} ` +
        `(checked ${checked} distinct names)\n`,
    );
    process.exit(1);
  }

  process.stderr.write(
    `check-fidelity: OK — ${checked} distinct catalog names all present in ${xsdPath}\n`,
  );
}

main();
