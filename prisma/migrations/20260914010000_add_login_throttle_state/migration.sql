ALTER TABLE "users"
ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failed_login_window_start" TIMESTAMPTZ(6),
ADD COLUMN "login_blocked_until" TIMESTAMPTZ(6);

ALTER TABLE "users"
ADD CONSTRAINT "users_failed_login_attempts_nonnegative"
CHECK ("failed_login_attempts" >= 0);
