// ───────────────── BLOCK 1: Imports ────────────────────────────
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeSecurityAuditEvent } from "@/features/security-audit/services/audit-service";
import {
  AUTH_SESSION_IDLE_SECONDS,
  getAbsoluteSessionAgeSeconds,
  getLoginRetryAfterSeconds,
  isAbsoluteSessionExpired,
  isLoginTemporarilyBlocked,
  resolveSessionStartedAt,
} from "@/features/auth/config/auth-security-policy";
import { registerFailedPassword } from "@/features/auth/services/login-throttle-service";
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

async function recordNonBlockingAuthEvent(
  input: Parameters<typeof writeSecurityAuditEvent>[0],
  failureMessage: string
) {
  try {
    await writeSecurityAuditEvent(input);
  } catch (error) {
    console.error(failureMessage, error);
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
            loginBlockedUntil: true,
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

        const authenticationTime = new Date();
        if (isLoginTemporarilyBlocked(user.loginBlockedUntil, authenticationTime)) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          try {
            const throttle = await registerFailedPassword(
              user.id,
              authenticationTime
            );
            if (throttle.becameBlocked && throttle.loginBlockedUntil) {
              await recordNonBlockingAuthEvent(
                {
                  eventType: "auth.login.rate_limited",
                  outcome: "DENIED",
                  actorEmailSnapshot: normalizedEmail,
                  targetType: "USER",
                  targetId: user.id,
                  reasonCode: "RATE_LIMITED",
                  metadata: {
                    failureCount: throttle.failedLoginAttempts,
                    retryAfterSeconds: getLoginRetryAfterSeconds(
                      throttle.loginBlockedUntil,
                      authenticationTime
                    ),
                  },
                },
                "Login throttle activation could not be audited"
              );
            } else {
              await recordLoginFailure({
                actorEmailSnapshot: normalizedEmail,
                targetType: "USER",
                targetId: user.id,
                reasonCode: "INVALID_CREDENTIALS",
              });
            }
          } catch (error) {
            console.error("Login throttle state could not be updated", error);
            await recordLoginFailure({
              actorEmailSnapshot: normalizedEmail,
              targetType: "USER",
              targetId: user.id,
              reasonCode: "INVALID_CREDENTIALS",
            });
          }
          return null;
        }

        await prisma.$transaction(async (transaction) => {
          await transaction.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: authenticationTime,
              failedLoginAttempts: 0,
              failedLoginWindowStart: null,
              loginBlockedUntil: null,
            },
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
    maxAge: AUTH_SESSION_IDLE_SECONDS,
  },
  callbacks: {
    async jwt({ token, user }) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.authVersion = user.authVersion;
        token.sessionStartedAt = nowSeconds;
        return token;
      }

      const sessionStartedAt = resolveSessionStartedAt(token, nowSeconds);
      token.sessionStartedAt = sessionStartedAt;
      if (isAbsoluteSessionExpired(sessionStartedAt, nowSeconds)) {
        if (typeof token.id === "string") {
          await recordNonBlockingAuthEvent(
            {
              eventType: "auth.session.expired",
              outcome: "SUCCESS",
              actorUserId: token.id,
              targetType: "USER",
              targetId: token.id,
              reasonCode: "ABSOLUTE_LIFETIME_REACHED",
              metadata: {
                expiryReason: "ABSOLUTE",
                sessionAgeSeconds: getAbsoluteSessionAgeSeconds(
                  sessionStartedAt,
                  nowSeconds
                ),
              },
            },
            "Absolute session expiry could not be audited"
          );
        }
        return null;
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
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token && typeof token.id === "string") {
        await recordNonBlockingAuthEvent(
          {
            eventType: "auth.logout.succeeded",
            outcome: "SUCCESS",
            actorUserId: token.id,
            targetType: "USER",
            targetId: token.id,
          },
          "Logout could not be audited"
        );
      }
    },
  },
  pages: {
    signIn: "/login",
  }
});
