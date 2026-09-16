import type { AuditOutcome } from "@prisma/client"
import Link from "next/link"
import { after } from "next/server"
import {
  ArrowLeft,
  Fingerprint,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import { requirePermission } from "@/features/auth/services/authorization-service"
import { AuditEventTable } from "@/features/security-audit/components/audit-event-table"
import {
  getAuditEventTypesForCategory,
  SECURITY_AUDIT_CATEGORIES,
  SECURITY_AUDIT_CATEGORY_DEFINITIONS,
  SECURITY_AUDIT_EVENT_REGISTRY,
  type SecurityAuditCategory,
} from "@/features/security-audit/services/audit-registry"
import {
  SECURITY_AUDIT_EVENT_TYPES,
  type SecurityAuditEventType,
} from "@/features/security-audit/services/audit-policy"
import {
  getSecurityAuditDashboard,
  getSecurityAuditEvents,
  writeSecurityAuditEvent,
} from "@/features/security-audit/services/audit-service"

export const dynamic = "force-dynamic"

const outcomes = ["SUCCESS", "FAILURE", "DENIED"] as const
const categoryOrder: SecurityAuditCategory[] = [
  "AUTHENTICATION",
  "ROLES_PERMISSIONS",
  "USER_LIFECYCLE",
  "SECURITY_OVERSIGHT",
]

function parseEventType(value: string | undefined) {
  return SECURITY_AUDIT_EVENT_TYPES.includes(value as SecurityAuditEventType)
    ? (value as SecurityAuditEventType)
    : undefined
}

function parseCategory(value: string | undefined) {
  return SECURITY_AUDIT_CATEGORIES.includes(value as SecurityAuditCategory)
    ? (value as SecurityAuditCategory)
    : undefined
}

function parseOutcome(value: string | undefined) {
  return outcomes.includes(value as AuditOutcome)
    ? (value as AuditOutcome)
    : undefined
}

function categoryIcon(category: SecurityAuditCategory) {
  if (category === "AUTHENTICATION") return <Fingerprint className="h-5 w-5" />
  if (category === "ROLES_PERMISSIONS") return <UserCog className="h-5 w-5" />
  if (category === "USER_LIFECYCLE") return <Users className="h-5 w-5" />
  return <ShieldCheck className="h-5 w-5" />
}

export default async function SecurityAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string
    eventType?: string
    outcome?: string
  }>
}) {
  let principal
  try {
    principal = await requirePermission("admin.audit.view")
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <PermissionDenied
          description="You need permission to view security monitoring."
          backHref="/settings/access"
          backLabel="Return to access control"
        />
      )
    }
    throw error
  }

  const rawFilters = await searchParams
  const category = parseCategory(rawFilters.category)
  let eventType = parseEventType(rawFilters.eventType)
  if (
    category &&
    eventType &&
    SECURITY_AUDIT_EVENT_REGISTRY[eventType].category !== category
  ) {
    eventType = undefined
  }
  const outcome = parseOutcome(rawFilters.outcome)
  const [dashboard, events] = await Promise.all([
    getSecurityAuditDashboard(),
    getSecurityAuditEvents({
      eventType,
      eventTypes: !eventType && category
        ? getAuditEventTypesForCategory(category)
        : undefined,
      outcome,
      take: 100,
    }),
  ])

  after(async () => {
    try {
      await writeSecurityAuditEvent({
        eventType: "auth.audit.viewed",
        outcome: "SUCCESS",
        actorUserId: principal.userId,
        targetType: "AUDIT_LOG",
        metadata: {
          eventTypeFilter: eventType ?? category ?? "ALL",
          outcomeFilter: outcome ?? "ALL",
          resultCount: events.length,
        },
      })
    } catch (error) {
      console.error("Security audit view could not be audited", error)
    }
  })

  const indicators = [
    {
      label: "Failed sign-ins",
      value: dashboard.indicators.failedLogins,
      description: "Rejected login attempts",
      icon: ShieldAlert,
      attention: dashboard.indicators.failedLogins > 0,
    },
    {
      label: "Credential activity",
      value: dashboard.indicators.credentialEvents,
      description: "Password changes and resets",
      icon: KeyRound,
      attention: false,
    },
    {
      label: "Access denials",
      value: dashboard.indicators.accessDenials,
      description: "Protected operations rejected",
      icon: ShieldCheck,
      attention: dashboard.indicators.accessDenials > 0,
    },
    {
      label: "Privilege changes",
      value: dashboard.indicators.privilegedChanges,
      description: "Roles and permissions changed",
      icon: UserCog,
      attention: false,
    },
    {
      label: "Sessions revoked",
      value: dashboard.indicators.sessionRevocations,
      description: "Security-triggered invalidations",
      icon: Fingerprint,
      attention: false,
    },
  ]
  const attentionCount =
    dashboard.indicators.failedLogins + dashboard.indicators.accessDenials

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/access">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Access Control
          </Link>
        </Button>
        <h1 className="sr-only">Security monitoring</h1>
      </div>

      <section className="space-y-4" aria-labelledby="security-overview-heading">
        <div>
          <h2 id="security-overview-heading" className="text-lg font-semibold">
            Security overview
          </h2>
          <p className="text-sm text-muted-foreground">Activity recorded during the last 24 hours.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {indicators.map(({ label, value, description, icon: Icon, attention }) => (
            <Card key={label} className={attention ? "border-warning/40" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>{label}</CardDescription>
                  <Icon className={attention ? "h-4 w-4 text-warning" : "h-4 w-4 text-primary"} />
                </div>
                <CardTitle className="text-3xl">{value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {attentionCount > 0 && (
          <Alert className="border-warning/40 bg-warning/10">
            <ShieldAlert />
            <AlertTitle>Security activity requires review</AlertTitle>
            <AlertDescription>
              {attentionCount} failed sign-in or denied-access event{attentionCount === 1 ? "" : "s"}
              {" "}were recorded during the last 24 hours. Review Authentication and Security Oversight below.
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="category-heading">
        <div>
          <h2 id="category-heading" className="text-lg font-semibold">Activity by category</h2>
          <p className="text-sm text-muted-foreground">
            Each section prioritises its most important recent events before routine activity.
          </p>
        </div>
        <div className="space-y-6">
          {categoryOrder.map((item) => {
            const definition = SECURITY_AUDIT_CATEGORY_DEFINITIONS[item]
            const categoryEvents = dashboard.categories[item]
            return (
              <Card key={item} id={`category-${item.toLowerCase()}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-primary">
                      {categoryIcon(item)}
                      <CardTitle>{definition.label}</CardTitle>
                    </div>
                    <CardDescription>{definition.description}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/settings/access/audit?category=${item}#all-activity`}>
                      View category
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <AuditEventTable events={categoryEvents} compact />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section id="all-activity" className="space-y-4" aria-labelledby="all-activity-heading">
        <div>
          <h2 id="all-activity-heading" className="text-lg font-semibold">All security activity</h2>
          <p className="text-sm text-muted-foreground">
            Use detailed filters when investigating a specific event or account change.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Investigation filters</CardTitle>
            <CardDescription>
              The newest 100 matching events are displayed. Audit-log views are also recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_190px_auto_auto] lg:items-end">
              <div className="grid gap-2 text-sm font-medium">
                <span>Category</span>
                <Select name="category" defaultValue={category ?? "ALL"}>
                  <SelectTrigger className="h-9 w-full" aria-label="Audit category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All categories</SelectItem>
                    {SECURITY_AUDIT_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {SECURITY_AUDIT_CATEGORY_DEFINITIONS[item].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 text-sm font-medium">
                <span>Event type</span>
                <Select name="eventType" defaultValue={eventType ?? "ALL"}>
                  <SelectTrigger className="h-9 w-full" aria-label="Event type">
                    <SelectValue placeholder="All event types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All event types</SelectItem>
                    {SECURITY_AUDIT_EVENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SECURITY_AUDIT_EVENT_REGISTRY[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 text-sm font-medium">
                <span>Outcome</span>
                <Select name="outcome" defaultValue={outcome ?? "ALL"}>
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
              {(category || eventType || outcome) && (
                <Button variant="outline" asChild>
                  <Link href="/settings/access/audit#all-activity">Clear</Link>
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
          <CardContent>
            <AuditEventTable
              events={events}
              emptyMessage="No audit events match these investigation filters."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
