import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EditorWorkspace } from "@/components/editor-workspace";
import { SubmissionHistoryPanel } from "@/components/submission-history-panel";
import { findProblem, getProblems } from "@/lib/problems";

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
          Back to list
        </Link>
      </div>

      <article className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
        <h2 className="font-semibold">Problem</h2>
        <p className="mt-2 text-sm leading-6 text-black/80 dark:text-white/80">{problem.statement}</p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <h3 className="font-medium">Sample Input</h3>
            <pre className="mt-1 rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-white/10">{problem.sampleInput}</pre>
          </div>
          <div>
            <h3 className="font-medium">Sample Output</h3>
            <pre className="mt-1 rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-white/10">{problem.sampleOutput}</pre>
          </div>
        </div>
      </article>

      <EditorWorkspace problemId={problem.id} starterCode={problem.starterCode} />
      <SubmissionHistoryPanel problemId={problem.id} />
    </section>
  );
}
