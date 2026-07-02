// Fidelity gate CLI (PLAN_MVP ground rule #2; docs/02-fidelity.md §5).
//
// Verifies every catalog name appears in the UCI XSD and every CERT/RQMT number
// appears in the UCI .txt specs. Machine-readable TSV to stdout, human summary to
// stderr, non-zero exit on failure (sibling convention).
//
// Usage: tsx tools/check-fidelity.ts [refs-dir]
//        FIDELITY_REFS=/path/to/refs tsx tools/check-fidelity.ts
import { existsSync } from "node:fs";
import { REFS_DIR } from "./catalog-source.ts";
import { findOffenders } from "./fidelity.ts";

function main(): void {
  const refsDir = process.argv[2] ?? process.env.FIDELITY_REFS ?? REFS_DIR;
  if (!existsSync(refsDir)) {
    process.stderr.write(`check-fidelity: refs dir not found at ${refsDir}\n`);
    process.exit(2);
  }

  const { offenders, checkedNames, checkedCerts } = findOffenders(refsDir);

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
      `check-fidelity: FAIL — ${distinct} invented name(s)/number(s) not found under ${refsDir}\n`,
    );
    process.exit(1);
  }

  process.stderr.write(
    `check-fidelity: OK — ${checkedNames} names present in the XSD, ` +
      `${checkedCerts} CERT/RQMT numbers present in the specs (${refsDir})\n`,
  );
}

main();
