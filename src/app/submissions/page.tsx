import { redirect } from "next/navigation";
import { SubmissionHistoryPanel } from "@/components/submission-history-panel";
import { auth } from "@/lib/auth";

export default async function SubmissionsPage() {
  try {
    const session = await auth();
    if (!session?.user?.email) redirect("/auth/signin");
  } catch {
    redirect("/auth/signin");
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submission History</h1>
        <p className="mt-1 text-sm text-black/70 dark:text-white/70">Recent submissions across all problems.</p>
      </div>
      <SubmissionHistoryPanel />
    </section>
  );
}
