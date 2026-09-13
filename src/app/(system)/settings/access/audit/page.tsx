import Link from "next/link"
import { ArrowLeft, History, Search } from "lucide-react"
import type { AuditOutcome } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import {
  isAuthorizationError,
} from "@/features/auth/services/authorization-policy"
import { requirePermission } from "@/features/auth/services/authorization-service"
import {
  SECURITY_AUDIT_EVENT_TYPES,
  type SecurityAuditEventType,
} from "@/features/security-audit/services/audit-policy"
import {
  getSecurityAuditEvents,
  writeSecurityAuditEvent,
} from "@/features/security-audit/services/audit-service"

export const dynamic = "force-dynamic"

const outcomes = ["SUCCESS", "FAILURE", "DENIED"] as const

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Australia/Sydney",
})

function parseEventType(value: string | undefined) {
  return SECURITY_AUDIT_EVENT_TYPES.includes(value as SecurityAuditEventType)
    ? (value as SecurityAuditEventType)
    : undefined
}

function parseOutcome(value: string | undefined) {
  return outcomes.includes(value as AuditOutcome)
    ? (value as AuditOutcome)
    : undefined
}

function outcomeVariant(outcome: AuditOutcome) {
  if (outcome === "SUCCESS") return "default" as const
  if (outcome === "FAILURE") return "destructive" as const
  return "outline" as const
}

function metadataSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const entries = Object.entries(metadata)
  if (entries.length === 0) return null
  return entries
    .map(([key, value]) =>
      `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
    )
    .join(" · ")
}

export default async function SecurityAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ eventType?: string; outcome?: string }>
}) {
  let principal
  try {
    principal = await requirePermission("admin.audit.view")
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <PermissionDenied
          description="You need permission to view the security audit history."
          backHref="/settings/access"
          backLabel="Return to access control"
        />
      )
    }
    throw error
  }

  const rawFilters = await searchParams
  const eventType = parseEventType(rawFilters.eventType)
  const outcome = parseOutcome(rawFilters.outcome)
  const events = await getSecurityAuditEvents({ eventType, outcome, take: 100 })

  await writeSecurityAuditEvent({
    eventType: "auth.audit.viewed",
    outcome: "SUCCESS",
    actorUserId: principal.userId,
    targetType: "AUDIT_LOG",
    metadata: {
      eventTypeFilter: eventType ?? "ALL",
      outcomeFilter: outcome ?? "ALL",
      resultCount: events.length,
    },
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/access">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Access Control
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Security audit history</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Review immutable authentication and access-control events. Times are shown in Sydney time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            The newest 100 matching events are displayed. Audit-log views are also recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto_auto] md:items-end">
            <div className="grid gap-2 text-sm font-medium">
              <span>Event type</span>
              <Select
                name="eventType"
                defaultValue={eventType ?? "ALL"}
              >
                <SelectTrigger className="h-9 w-full" aria-label="Event type">
                  <SelectValue placeholder="All event types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All event types</SelectItem>
                  {SECURITY_AUDIT_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 text-sm font-medium">
              <span>Outcome</span>
              <Select
                name="outcome"
                defaultValue={outcome ?? "ALL"}
              >
                <SelectTrigger className="h-9 w-full" aria-label="Outcome">
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All outcomes</SelectItem>
                  {outcomes.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Apply
            </Button>
            {(eventType || outcome) && (
              <Button variant="outline" asChild>
                <Link href="/settings/access/audit">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recorded events</CardTitle>
          <CardDescription>{events.length} matching events.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Occurred</TableHead>
                <TableHead className="min-w-56">Event</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="min-w-48">Actor</TableHead>
                <TableHead className="min-w-48">Target</TableHead>
                <TableHead className="min-w-80">Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No audit events match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const summary = metadataSummary(event.metadata)
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {dateFormatter.format(event.occurredAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{event.eventType}</div>
                        {event.reasonCode && (
                          <div className="mt-1 text-xs text-muted-foreground">{event.reasonCode}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={outcomeVariant(event.outcome)}>{event.outcome}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.actor ? (
                          <>
                            <div className="font-medium">{event.actor.name}</div>
                            <div className="text-xs text-muted-foreground">{event.actor.email}</div>
                          </>
                        ) : event.actorEmailSnapshot ? (
                          <span className="text-xs text-muted-foreground">{event.actorEmailSnapshot}</span>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.targetType ?? "—"}
                        {event.targetId && (
                          <div className="max-w-48 truncate font-mono text-xs text-muted-foreground" title={event.targetId}>
                            {event.targetId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {summary ?? "—"}
                        <div className="mt-1 font-mono text-[11px]" title={event.correlationId}>
                          Correlation {event.correlationId.slice(0, 8)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
