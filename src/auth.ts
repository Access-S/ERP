// ───────────────── BLOCK 1: Imports ────────────────────────────
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeSecurityAuditEvent } from "@/features/security-audit/services/audit-service";
import bcrypt from "bcryptjs";

async function recordLoginFailure(
  input: Omit<
    Parameters<typeof writeSecurityAuditEvent>[0],
    "eventType" | "outcome"
  >
) {
  try {
    await writeSecurityAuditEvent({
      ...input,
      eventType: "auth.login.failed",
      outcome: "FAILURE",
    });
  } catch (error) {
    // A failed audit sink must be visible operationally, but it must not turn a
    // rejected credential attempt into a different client response.
    console.error("Login failure could not be audited", error);
  }
}

// ───────────────── BLOCK 2: Auth Configuration ──────────────────
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string"
        ) {
          await recordLoginFailure({
            reasonCode: "INVALID_INPUT",
            targetType: "USER",
          });
          return null;
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const passwordBytes = new TextEncoder().encode(credentials.password).length;
        if (
          !normalizedEmail ||
          normalizedEmail.length > 254 ||
          !credentials.password ||
          passwordBytes > 72
        ) {
          await recordLoginFailure({
            actorEmailSnapshot: normalizedEmail,
            reasonCode: "INVALID_INPUT",
            targetType: "USER",
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { normalizedEmail },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            status: true,
            authVersion: true,
          },
        });

        if (!user || user.status !== UserStatus.ACTIVE || !user.password) {
          await recordLoginFailure({
            actorEmailSnapshot: normalizedEmail,
            targetType: "USER",
            targetId: user?.id,
            reasonCode: user ? "ACCOUNT_UNAVAILABLE" : "INVALID_CREDENTIALS",
          });
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          await recordLoginFailure({
            actorEmailSnapshot: normalizedEmail,
            targetType: "USER",
            targetId: user.id,
            reasonCode: "INVALID_CREDENTIALS",
          });
          return null;
        }

        await prisma.$transaction(async (transaction) => {
          await transaction.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          await writeSecurityAuditEvent(
            {
              eventType: "auth.login.succeeded",
              outcome: "SUCCESS",
              actorUserId: user.id,
              targetType: "USER",
              targetId: user.id,
              metadata: { authenticationMethod: "PASSWORD" },
            },
            transaction
          );
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authVersion: user.authVersion,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.authVersion = user.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.authVersion = token.authVersion as number;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  }
});
