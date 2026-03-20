import Link from "next/link";
import { problems } from "@/lib/problems";

export default function ProblemListPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">Choose a problem and open the coding workspace.</p>
      </div>

      <div className="space-y-3">
        {problems.map((problem) => (
          <Link
            key={problem.id}
            href={`/problems/${problem.id}`}
            className="block rounded-md border border-black/10 bg-white p-4 transition hover:border-black/25 dark:border-white/10 dark:bg-[#111827] dark:hover:border-white/25"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{problem.title}</h2>
              <span className="rounded border border-black/10 px-2 py-0.5 text-xs dark:border-white/15">{problem.difficulty}</span>
            </div>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">{problem.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-black/60 dark:text-white/60">
              {problem.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
