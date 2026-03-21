import { mapProblem, ProblemDTO, ensureAppData } from "./data";
import { prisma } from "./prisma";

export async function getProblems(): Promise<ProblemDTO[]> {
  await ensureAppData();
  const problems = await prisma.problem.findMany({ orderBy: { createdAt: "asc" } });
  return problems.map(mapProblem);
}

export async function findProblem(id: string): Promise<ProblemDTO | null> {
  await ensureAppData();
  const problem = await prisma.problem.findUnique({ where: { id } });
  return problem ? mapProblem(problem) : null;
}
