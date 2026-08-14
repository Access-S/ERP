'use client'

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { useState } from 'react'
import {
  HoldConfirmButton,
  HoldConfirmIconButton,
} from '@/components/shared/HoldConfirmButton'
import {
  Calendar,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPresetTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
} from '@/components/shared/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Trash2, AlertTriangle, RotateCcw, Shield } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { type CalendarDateRange, type CalendarValue } from '@/types/calendar'

// ───────────────── BLOCK 2: Types ──────────────────────────────
interface ActionLog {
  id: number
  label: string
  timestamp: string
}

// ───────────────── BLOCK 3: Page Component ─────────────────────
export default function PlaygroundPage() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [nextId, setNextId] = useState(1)

  // Calendar test states
  const [singleDate, setSingleDate] = useState<CalendarValue>(undefined)
  const [dateRange, setDateRange] = useState<CalendarValue>(undefined)

  const handleConfirm = (label: string) => {
    const now = new Date().toLocaleTimeString()
    setLogs((prev) => [{ id: nextId, label, timestamp: now }, ...prev])
    setNextId((id) => id + 1)
  }

  const clearLogs = () => {
    setLogs([])
    setNextId(1)
  }

  const formatValue = (val: CalendarValue): string => {
    if (!val) return 'None'
    if (val instanceof Date) return val.toLocaleDateString()
    if (Array.isArray(val)) return val.map((d) => d.toLocaleDateString()).join(', ')
    if (typeof val === 'object' && 'from' in val) {
      const r = val as CalendarDateRange
      return `${r.from.toLocaleDateString()} → ${r.to?.toLocaleDateString() || '...'}`
    }
    return 'Unknown'
  }

  const scrollTags = Array.from({ length: 50 }, (_, i) => `v1.0.0-beta.${i}`)

  return (
    <div className="container mx-auto py-12 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Component Playground
        </h1>
        <p className="text-muted-foreground mt-2">
          Test shared components in isolation before feature integration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT COLUMN: HoldConfirm Buttons */}
        <div className="space-y-6">
          {/* Traditional Fill Button */}
          <Card>
            <CardHeader>
              <CardTitle>HoldConfirmButton</CardTitle>
              <CardDescription>
                Fill-layer button. Hold to trigger, release to cancel.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <HoldConfirmButton
                onConfirm={() => handleConfirm('Traditional button executed')}
                duration={1500}
              >
                <AlertTriangle className="h-4 w-4" />
                Hold to Confirm
              </HoldConfirmButton>

              <HoldConfirmButton
                onConfirm={() => handleConfirm('Danger button executed')}
                duration={2000}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4" />
                Hold to Delete (2s)
              </HoldConfirmButton>
            </CardContent>
          </Card>

          {/* Icon Ring Button */}
          <Card>
            <CardHeader>
              <CardTitle>HoldConfirmIconButton</CardTitle>
              <CardDescription>
                SVG ring progress. All Shadcn variants supported.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-8">
              <div className="flex items-center gap-4">
                {(['default', 'secondary', 'outline', 'ghost', 'destructive'] as const).map(
                  (v) => (
                    <div key={v} className="flex flex-col items-center gap-2">
                      <HoldConfirmIconButton
                        variant={v}
                        onConfirm={() => handleConfirm(`${v} icon button executed`)}
                        duration={1500}
                        icon={<Trash2 className="h-4 w-4" />}
                      />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {v}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center gap-6">
                {[32, 40, 48].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-2">
                    <HoldConfirmIconButton
                      variant="outline"
                      onConfirm={() => handleConfirm(`${s}px icon button executed`)}
                      duration={1500}
                      icon={<Trash2 className={s === 32 ? 'h-3 w-3' : s === 48 ? 'h-5 w-5' : 'h-4 w-4'} />}
                      size={s}
                    />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s}px
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ScrollArea */}
          <Card>
            <CardHeader>
              <CardTitle>ScrollArea</CardTitle>
              <CardDescription>
                Custom scrollable container with scrollFade gradient overlay.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <ScrollArea className="h-64 w-48 rounded-md border" scrollFade>
                <div className="p-4">
                  <h4 className="mb-4 font-medium text-sm leading-none">Tags</h4>
                  {scrollTags.map((tag) => (
                    <div key={tag}>
                      <div className="text-sm">{tag}</div>
                      <Separator className="my-2" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Calendar */}
        <div className="space-y-6">
          {/* Range Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Calendar — Range Selection</CardTitle>
              <CardDescription>
                Compound component with presets. Click start date, then end date.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Calendar
                className="[--cell-size:--spacing(8)]"
                selectionMode="range"
                value={dateRange}
                onChange={setDateRange}
              >
                <div className="border rounded-lg p-4 w-full max-w-xs">
                  <CalendarViewControl>
                    <CalendarPrevTrigger />
                    <CalendarMonthSelect />
                    <CalendarYearSelect />
                    <CalendarNextTrigger />
                  </CalendarViewControl>
                  <CalendarTable>
                    <CalendarWeekDays />
                    <CalendarTableDays />
                  </CalendarTable>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                    {presets.map((preset) => (
                      <CalendarPresetTrigger
                        asChild
                        key={preset.value}
                        value={preset.value}
                      >
                        <Button className="flex-1" size="sm" variant="outline">
                          {preset.label}
                        </Button>
                      </CalendarPresetTrigger>
                    ))}
                  </div>
                </div>
              </Calendar>

              <div className="w-full max-w-xs p-3 rounded-md bg-muted">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Selected Range
                </p>
                <p className="text-sm font-mono text-foreground">
                  {formatValue(dateRange)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Single Date Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Calendar — Single Selection</CardTitle>
              <CardDescription>
                Standard single-date picker.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Calendar
                className="[--cell-size:--spacing(7)]"
                selectionMode="single"
                value={singleDate}
                onChange={setSingleDate}
              >
                <div className="border rounded-lg p-4 w-full max-w-[280px]">
                  <CalendarViewControl>
                    <CalendarPrevTrigger />
                    <CalendarMonthSelect />
                    <CalendarYearSelect />
                    <CalendarNextTrigger />
                  </CalendarViewControl>
                  <CalendarTable>
                    <CalendarWeekDays />
                    <CalendarTableDays />
                  </CalendarTable>
                </div>
              </Calendar>

              <div className="w-full max-w-[280px] p-3 rounded-md bg-muted">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Selected Date
                </p>
                <p className="text-sm font-mono text-foreground">
                  {formatValue(singleDate)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Log — Full Width */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>
                {logs.length === 0
                  ? 'No actions triggered yet.'
                  : `${logs.length} action${logs.length > 1 ? 's' : ''} triggered.`}
              </CardDescription>
            </div>
            {logs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
                className="gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Interact with any component above to see actions logged here.
              </p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-muted"
                  >
                    <span className="font-medium text-foreground">
                      {log.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {log.timestamp}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const presets = [
  { label: 'Last 7 days', value: 'last7Days' as const },
  { label: 'Last 14 days', value: 'last14Days' as const },
  { label: 'Last 30 days', value: 'last30Days' as const },
  { label: 'This month', value: 'thisMonth' as const },
] as const

// ───────────────── BLOCK 4: Exports ────────────────────────────