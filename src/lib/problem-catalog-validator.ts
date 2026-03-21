import { problemCatalog } from "./problem-catalog";
import { hiddenTestCatalog } from "./problem-hidden-tests";

let validated = false;

export function validateProblemCatalogIntegrity() {
  if (validated) return;

  const ids = new Set<string>();
  for (const problem of problemCatalog) {
    if (ids.has(problem.id)) {
      throw new Error(`[catalog] duplicate problem id: ${problem.id}`);
    }
    ids.add(problem.id);

    if (!problem.sampleTests?.length) {
      throw new Error(`[catalog] sample tests missing: ${problem.id}`);
    }

    const hidden = hiddenTestCatalog[problem.id] ?? [];
    if (hidden.length === 0) {
      throw new Error(`[catalog] hidden tests missing: ${problem.id}`);
    }

    for (const [index, tc] of hidden.entries()) {
      if (typeof tc.input !== "string" || typeof tc.output !== "string") {
        throw new Error(`[catalog] invalid hidden testcase format: ${problem.id}#${index + 1}`);
      }
      if (!tc.output.endsWith("\n")) {
        throw new Error(`[catalog] hidden testcase expected output must be deterministic (trailing newline required): ${problem.id}#${index + 1}`);
      }
    }
  }

  validated = true;
}
