import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireSessionUser();
  if (session.error) return session.error;

  const [problemWeakness, topicWeakness, recentFailed] = await Promise.all([
    prisma.userProblemWeakness.findMany({
      where: { userId: session.user.id, weaknessScore: { gt: 0 } },
      orderBy: [{ weaknessScore: "desc" }, { updatedAt: "desc" }],
      take: 20,
      include: { problem: { select: { id: true, title: true, difficulty: true } } },
    }),
    prisma.userTopicWeakness.findMany({
      where: { userId: session.user.id, weaknessScore: { gt: 0 } },
      orderBy: [{ weaknessScore: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.submission.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["WRONG_ANSWER", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "COMPILATION_ERROR"] },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        problemId: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const recentMap = new Map<string, { failedAt: string; status: string }>();
  for (const row of recentFailed) {
    if (!recentMap.has(row.problemId)) {
      recentMap.set(row.problemId, { failedAt: row.createdAt.toISOString(), status: row.status });
    }
  }

  const items = problemWeakness.map((row) => ({
    problemId: row.problemId,
    title: row.problem.title,
    difficulty: row.problem.difficulty,
    weaknessScore: row.weaknessScore,
    failCount: row.failCount,
    lastStatus: row.lastStatus,
    lastFeedbackAction: row.lastFeedbackAction,
    lastFailedAt: row.lastFailedAt?.toISOString() ?? recentMap.get(row.problemId)?.failedAt ?? null,
    recentFailureStatus: recentMap.get(row.problemId)?.status ?? null,
  }));

  return NextResponse.json({
    items,
    weakTopics: topicWeakness.map((topic) => ({
      topic: topic.topic,
      weaknessScore: topic.weaknessScore,
      failCount: topic.failCount,
      lastStatus: topic.lastStatus,
      lastFailedAt: topic.lastFailedAt?.toISOString() ?? null,
    })),
  });
}
