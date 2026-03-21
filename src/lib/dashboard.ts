import { SubmissionStatus } from "@prisma/client";
import { ensureAppData } from "./data";
import { prisma } from "./prisma";
import { problemCatalog } from "./problem-catalog";

export async function getDashboardStats(userId?: string) {
  try {
    await ensureAppData();

    const [problemCount, attempts, solvedIds] = await Promise.all([
      prisma.problem.count(),
      userId ? prisma.submission.count({ where: { userId } }) : Promise.resolve(0),
      userId
        ? prisma.submission.findMany({
            where: { userId, status: SubmissionStatus.ACCEPTED },
            select: { problemId: true },
            distinct: ["problemId"],
          })
        : Promise.resolve([]),
    ]);

    return {
      totalProblems: problemCount,
      attemptCount: attempts,
      solvedCount: solvedIds.length,
      streakDays: attempts > 0 ? 1 : 0,
    };
  } catch {
    return {
      totalProblems: problemCatalog.length,
      attemptCount: 0,
      solvedCount: 0,
      streakDays: 0,
    };
  }
}
