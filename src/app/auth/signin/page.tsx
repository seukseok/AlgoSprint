"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("dev@algosprint.local");
  const [password, setPassword] = useState("devpass123");

  async function onDevSubmit(event: FormEvent) {
    event.preventDefault();
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
    });
  }

  return (
    <section className="mx-auto max-w-md space-y-4 rounded-md border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111827]">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-black/70 dark:text-white/70">Use GitHub OAuth or local dev credentials.</p>

      <button
        onClick={() => void signIn("github", { callbackUrl: "/" })}
        className="w-full rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        Continue with GitHub
      </button>

      <form onSubmit={(event) => void onDevSubmit(event)} className="space-y-2 rounded border border-black/10 p-3 dark:border-white/10">
        <h2 className="text-sm font-medium">Dev credentials</h2>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/15"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          name="password"
          type="password"
          placeholder="Password"
          required
          className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/15"
        />
        <button className="w-full rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          Sign in (Dev)
        </button>
      </form>
    </section>
  );
}
