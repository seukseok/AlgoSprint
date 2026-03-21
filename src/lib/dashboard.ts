import { SubmissionStatus } from "@prisma/client";
import { ensureAppData, getMockUser } from "./data";
import { prisma } from "./prisma";

export async function getDashboardStats() {
  await ensureAppData();
  const user = await getMockUser();

  const [problemCount, attempts, solvedIds] = await Promise.all([
    prisma.problem.count(),
    prisma.submission.count({ where: { userId: user.id } }),
    prisma.submission.findMany({
      where: { userId: user.id, status: SubmissionStatus.ACCEPTED },
      select: { problemId: true },
      distinct: ["problemId"],
    }),
  ]);

  return {
    totalProblems: problemCount,
    attemptCount: attempts,
    solvedCount: solvedIds.length,
    streakDays: attempts > 0 ? 1 : 0,
  };
}
