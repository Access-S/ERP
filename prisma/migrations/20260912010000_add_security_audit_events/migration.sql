CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

CREATE TABLE "security_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_email_snapshot" VARCHAR(254),
    "target_type" VARCHAR(40),
    "target_id" VARCHAR(128),
    "reason_code" VARCHAR(80),
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "security_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_audit_events_occurred_at_idx"
ON "security_audit_events"("occurred_at" DESC);

CREATE INDEX "security_audit_events_event_type_occurred_at_idx"
ON "security_audit_events"("event_type", "occurred_at" DESC);

CREATE INDEX "security_audit_events_actor_user_id_occurred_at_idx"
ON "security_audit_events"("actor_user_id", "occurred_at" DESC);

CREATE INDEX "security_audit_events_target_type_target_id_occurred_at_idx"
ON "security_audit_events"("target_type", "target_id", "occurred_at" DESC);

CREATE INDEX "security_audit_events_correlation_id_idx"
ON "security_audit_events"("correlation_id");

-- Audit rows are immutable even if application code accidentally receives a
-- Prisma update/delete capability. Inserts and transaction rollbacks remain
-- available; ordinary UPDATE and DELETE statements are rejected by PostgreSQL.
CREATE FUNCTION "reject_security_audit_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'security audit events are append-only';
END;
$$;

CREATE TRIGGER "security_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "security_audit_events"
FOR EACH ROW EXECUTE FUNCTION "reject_security_audit_mutation"();
