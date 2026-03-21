import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/session-user";
import { HarnessClient } from "@/components/harness-client";

export default async function AdminHarnessPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/auth/signin");
  if (!isAdminEmail(email)) redirect("/");

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin / Dev Queue Harness</h1>
        <p className="mt-1 text-sm text-black/70 dark:text-white/70">Trigger queue jobs and inspect status transitions.</p>
      </div>
      <HarnessClient />
    </section>
  );
}
