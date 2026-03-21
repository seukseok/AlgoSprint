"use client";

import { signOut } from "next-auth/react";

export default function SignOutPage() {
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-md border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111827]">
      <h1 className="text-xl font-semibold">Sign out</h1>
      <p className="text-sm text-black/70 dark:text-white/70">End your current session.</p>
      <button
        onClick={() => void signOut({ callbackUrl: "/" })}
        className="w-full rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        Confirm sign out
      </button>
    </section>
  );
}
