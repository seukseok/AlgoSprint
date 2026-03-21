import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return null;
    const name = session?.user?.name ?? null;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name ?? undefined,
      },
      create: {
        email,
        name,
      },
    });

    return user;
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }

  return { error: null, user };
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (list.includes(email.toLowerCase())) return true;
  return process.env.NODE_ENV !== "production";
}
