import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReviewQueuePage() {
  let email = "";
  try {
    const session = await auth();
    if (!session?.user?.email) redirect("/auth/signin");
    email = session.user.email;
  } catch {
    redirect("/auth/signin");
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) redirect("/auth/signin");

  const [problemWeakness, weakTopics] = await Promise.all([
    prisma.userProblemWeakness.findMany({
      where: { userId: user.id, weaknessScore: { gt: 0 } },
      orderBy: [{ weaknessScore: "desc" }, { updatedAt: "desc" }],
      take: 20,
      include: { problem: { select: { id: true, title: true, difficulty: true } } },
    }),
    prisma.userTopicWeakness.findMany({
      where: { userId: user.id, weaknessScore: { gt: 0 } },
      orderBy: [{ weaknessScore: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
  ]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">복습 큐</h1>
        <p className="mt-1 text-sm text-black/70 dark:text-white/70">약한 토픽과 최근 실패 기록을 기반으로 재도전 우선순위를 보여줍니다.</p>
      </div>

      <article className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
        <h2 className="text-sm font-semibold">약한 토픽</h2>
        {weakTopics.length === 0 ? (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">아직 취약 토픽이 없습니다. 제출을 진행하면 자동으로 누적됩니다.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {weakTopics.map((topic) => (
              <span key={topic.id} className="rounded border border-black/10 px-2 py-1 dark:border-white/10">
                {topic.topic} · 위험도 {topic.weaknessScore}
              </span>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
        <h2 className="text-sm font-semibold">우선 재도전 문제</h2>
        {problemWeakness.length === 0 ? (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">현재 복습 큐가 비어 있습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {problemWeakness.map((row, index) => (
              <li key={row.id} className="rounded border border-black/10 p-3 text-sm dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{index + 1}. {row.problem.title}</p>
                    <p className="text-xs text-black/60 dark:text-white/60">
                      난이도 {row.problem.difficulty} · 누적 실패 {row.failCount}회 · 위험도 {row.weaknessScore}
                    </p>
                  </div>
                  <Link href={`/problems/${row.problemId}`} className="text-xs underline-offset-4 hover:underline">
                    다시 풀기
                  </Link>
                </div>
                <p className="mt-1 text-xs text-black/70 dark:text-white/70">
                  최근 상태: {row.lastStatus ?? "-"} · 추천 액션: {row.lastFeedbackAction ?? "-"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
