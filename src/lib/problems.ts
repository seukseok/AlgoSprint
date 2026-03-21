import { mapProblem, ProblemDTO, ensureAppData } from "./data";
import { prisma } from "./prisma";
import { problemCatalog } from "./problem-catalog";

function catalogToDTO(): ProblemDTO[] {
  return problemCatalog.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags,
    summary: p.summary,
    statement: p.statement,
    sampleInput: p.sampleInput,
    sampleOutput: p.sampleOutput,
    starterCode: p.starterCode,
  }));
}

export async function getProblems(): Promise<ProblemDTO[]> {
  try {
    await ensureAppData();
    const problems = await prisma.problem.findMany({ orderBy: { createdAt: "asc" } });
    return problems.map(mapProblem);
  } catch {
    return catalogToDTO();
  }
}

export async function findProblem(id: string): Promise<ProblemDTO | null> {
  try {
    await ensureAppData();
    const problem = await prisma.problem.findUnique({ where: { id } });
    return problem ? mapProblem(problem) : null;
  } catch {
    const fallback = catalogToDTO().find((p) => p.id === id);
    return fallback ?? null;
  }
}
