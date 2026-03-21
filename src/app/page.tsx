import Link from "next/link";
import { getDashboardStats } from "@/lib/dashboard";
import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/session-user";

export default async function DashboardPage() {
  let userId: string | undefined;
  try {
    const session = await auth();
    const user = session?.user?.email ? await getSessionUser() : null;
    userId = user?.id;
  } catch {
    userId = undefined;
  }

  const stats = await getDashboardStats(userId);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="mt-2 text-black/70 dark:text-white/70">C++ 알고리즘 학습을 위한 컴파일/실행/디버그/제출 워크플로를 제공합니다.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card title="전체 문제" value={`${stats.totalProblems}`} />
        <Card title="시도 횟수" value={`${stats.attemptCount}`} />
        <Card title="해결한 문제" value={`${stats.solvedCount}`} />
        <Card title="연속 학습" value={`${stats.streakDays}일`} />
      </div>

      <div className="rounded-md border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111827]">
        <h2 className="text-lg font-semibold">빠른 시작</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">문제 목록에서 하나를 선택해 코딩 워크스페이스를 열고 바로 풀이를 시작하세요.</p>
        <Link href="/problems" className="mt-4 inline-block rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          문제 보러 가기
        </Link>
      </div>
    </section>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
      <p className="text-sm text-black/60 dark:text-white/60">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}
