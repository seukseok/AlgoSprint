import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/problems", label: "Problems" },
  { href: "/submissions", label: "Submissions" },
];

export function TopNav() {
  return (
    <header className="border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          AlgoSprint C++
        </Link>
        <nav className="flex gap-4 text-sm text-black/70 dark:text-white/70">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-black dark:hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
