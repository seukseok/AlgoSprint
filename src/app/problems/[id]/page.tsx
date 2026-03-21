import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EditorWorkspace } from "@/components/editor-workspace";
import { SubmissionHistoryPanel } from "@/components/submission-history-panel";
import { findProblem, getProblems } from "@/lib/problems";
import { ConceptCard } from "@/components/concept-card";

export async function generateStaticParams() {
  const problems = await getProblems();
  return problems.map((problem) => ({ id: problem.id }));
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const session = await auth();
    if (!session?.user?.email) redirect("/auth/signin");
  } catch {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const problem = await findProblem(id);
  if (!problem) return notFound();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{problem.title}</h1>
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">{problem.summary}</p>
        </div>
        <Link href="/problems" className="text-sm text-black/70 underline-offset-4 hover:underline dark:text-white/70">
          문제 목록으로
        </Link>
      </div>

      <article className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
        <h2 className="font-semibold">문제 설명</h2>
        <p className="mt-2 text-sm leading-6 text-black/80 dark:text-white/80">{problem.statement}</p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <h3 className="font-medium">입력 예시</h3>
            <pre className="mt-1 rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-white/10">{problem.sampleInput}</pre>
          </div>
          <div>
            <h3 className="font-medium">출력 예시</h3>
            <pre className="mt-1 rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-white/10">{problem.sampleOutput}</pre>
          </div>
        </div>
      </article>

      {problem.conceptGuide ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ConceptCard title="핵심 개념" items={problem.conceptGuide.coreConcepts} />
          <ConceptCard title="풀이 접근 순서" items={problem.conceptGuide.approachSteps} />
          <ConceptCard title="자주 하는 실수" items={problem.conceptGuide.pitfalls} />
          <section className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
            <h3 className="text-sm font-semibold">시간복잡도/공간복잡도 가이드</h3>
            <div className="mt-2 space-y-1 text-sm text-black/80 dark:text-white/80">
              <p>시간복잡도: {problem.conceptGuide.complexity.time}</p>
              <p>공간복잡도: {problem.conceptGuide.complexity.space}</p>
            </div>
          </section>
        </div>
      ) : null}

      <EditorWorkspace problemId={problem.id} starterCode={problem.starterCode} />
      <SubmissionHistoryPanel problemId={problem.id} />
    </section>
  );
}
