import Link from "next/link";
import { auth } from "@/lib/auth";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/problems", label: "Problems" },
  { href: "/submissions", label: "Submissions" },
  { href: "/admin/harness", label: "Dev Harness" },
];

export async function TopNav() {
  const session = await auth();
  const isSignedIn = Boolean(session?.user?.email);

  return (
    <header className="border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          AlgoSprint C++
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex gap-4 text-sm text-black/70 dark:text-white/70">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-black dark:hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          {isSignedIn ? (
            <Link href="/auth/signout" className="rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              Sign out
            </Link>
          ) : (
            <Link href="/auth/signin" className="rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
