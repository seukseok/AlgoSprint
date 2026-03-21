import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";

function devCredentialConfig() {
  const isDev = process.env.NODE_ENV !== "production";
  const email = process.env.DEV_LOGIN_EMAIL ?? (isDev ? "dev@algosprint.local" : undefined);
  const password = process.env.DEV_LOGIN_PASSWORD ?? (isDev ? "devpass123" : undefined);
  const allow = Boolean(email && password);
  return { isDev, email, password, allow };
}

const providers: NextAuthOptions["providers"] = [];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

providers.push(
  CredentialsProvider({
    name: "Dev Login",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const { allow, email, password } = devCredentialConfig();
      if (!allow || !email || !password) return null;

      const submittedEmail = String(credentials?.email ?? "").trim().toLowerCase();
      const submittedPassword = String(credentials?.password ?? "");
      if (submittedEmail !== email.toLowerCase() || submittedPassword !== password) return null;

      return {
        id: `dev:${submittedEmail}`,
        email: submittedEmail,
        name: "Dev User",
      };
    },
  }),
);

export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
