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
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-black/70 dark:text-white/70">
          Focused C++ practice environment with compile/run/debug/submit workflow.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card title="Total problems" value={`${stats.totalProblems}`} />
        <Card title="Attempts" value={`${stats.attemptCount}`} />
        <Card title="Solved" value={`${stats.solvedCount}`} />
        <Card title="Streak" value={`${stats.streakDays} day`} />
      </div>

      <div className="rounded-md border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111827]">
        <h2 className="text-lg font-semibold">Quick start</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Open the problem list and jump into the coding workspace. Keyboard-first actions are available.
        </p>
        <Link href="/problems" className="mt-4 inline-block rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          Browse Problems
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
