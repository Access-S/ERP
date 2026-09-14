import type { AuditOutcome } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  classifySecurityAuditEvent,
  type SecurityAuditSeverity,
} from "../services/audit-registry"
import type { SecurityAuditEventRecord } from "../services/audit-service"

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
})

function outcomeVariant(outcome: AuditOutcome) {
  if (outcome === "SUCCESS") return "default" as const
  if (outcome === "FAILURE") return "destructive" as const
  return "outline" as const
}

function severityClassName(severity: SecurityAuditSeverity) {
  if (severity === "CRITICAL") return "border-destructive/40 bg-destructive/10 text-destructive"
  if (severity === "WARNING") return "border-warning/40 bg-warning/10 text-warning"
  if (severity === "NOTICE") return "border-primary/30 bg-primary/10 text-primary"
  return "text-muted-foreground"
}

function metadataSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const entries = Object.entries(metadata)
  if (entries.length === 0) return null
  return entries
    .map(([key, value]) =>
      `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
    )
    .join(" · ")
}

export function AuditEventTable({
  events,
  emptyMessage = "No events have been recorded in this category.",
  compact = false,
}: {
  events: SecurityAuditEventRecord[]
  emptyMessage?: string
  compact?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-40">Occurred</TableHead>
            <TableHead className="min-w-56">Event</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="min-w-48">Actor</TableHead>
            <TableHead className="min-w-44">Target</TableHead>
            {!compact && <TableHead className="min-w-72">Context</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={compact ? 5 : 6}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => {
              const classification = classifySecurityAuditEvent(event)
              const summary = metadataSummary(event.metadata)
              return (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {dateFormatter.format(event.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{classification.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {classification.description}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {event.eventType}
                    </div>
                    {compact && summary && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{summary}</div>
                    )}
                    {event.reasonCode && (
                      <div className="mt-1 text-xs text-muted-foreground">{event.reasonCode}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge
                        variant="outline"
                        className={severityClassName(classification.severity)}
                      >
                        {classification.severity}
                      </Badge>
                      <Badge variant={outcomeVariant(event.outcome)}>{event.outcome}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.actor ? (
                      <>
                        <div className="font-medium">{event.actor.name}</div>
                        <div className="text-xs text-muted-foreground">{event.actor.email}</div>
                      </>
                    ) : event.actorEmailSnapshot ? (
                      <span className="text-xs text-muted-foreground">
                        {event.actorEmailSnapshot}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.targetUser ? (
                      <>
                        <div className="font-medium">{event.targetUser.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {event.targetUser.email}
                        </div>
                      </>
                    ) : (
                      <>
                        {event.targetType ?? "—"}
                        {event.targetId && (
                          <div
                            className="max-w-44 truncate font-mono text-xs text-muted-foreground"
                            title={event.targetId}
                          >
                            {event.targetId}
                          </div>
                        )}
                      </>
                    )}
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-xs text-muted-foreground">
                      {summary ?? "—"}
                      <div className="mt-1 font-mono text-[11px]" title={event.correlationId}>
                        Correlation {event.correlationId.slice(0, 8)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
