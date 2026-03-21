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
      <h1 className="text-xl font-semibold">로그인</h1>
      <p className="text-sm text-black/70 dark:text-white/70">GitHub OAuth 또는 로컬 개발 계정으로 로그인하세요.</p>

      <button
        onClick={() => void signIn("github", { callbackUrl: "/" })}
        className="w-full rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        GitHub로 계속하기
      </button>

      <form onSubmit={(event) => void onDevSubmit(event)} className="space-y-2 rounded border border-black/10 p-3 dark:border-white/10">
        <h2 className="text-sm font-medium">개발 계정</h2>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          name="email"
          type="email"
          placeholder="이메일"
          required
          className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/15"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          name="password"
          type="password"
          placeholder="비밀번호"
          required
          className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/15"
        />
        <button className="w-full rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          개발 계정으로 로그인
        </button>
      </form>
    </section>
  );
}
