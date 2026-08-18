// ───────────────── BLOCK 1: Imports ────────────────────────────
import { useState, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Calendar,
  CalendarClearTrigger,
  CalendarFooter,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPresetTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarTodayTrigger,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
} from '@/components/shared/calendar'
import { CalendarDays, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type CalendarDateRange,
  type CalendarPresetValue,
  type CalendarSelectionMode,
  type CalendarValue,
} from '@/types/calendar'

// ───────────────── BLOCK 2: Types & Defaults ───────────────────
interface DatePickerProps {
  value?: CalendarValue
  onChange?: (value: CalendarValue) => void
  selectionMode?: CalendarSelectionMode
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  disabledDates?: Date[]
  weekStartsOn?: 0 | 1
  fixedWeeks?: boolean
  disabled?: boolean
  className?: string
  presets?: { label: string; value: CalendarPresetValue }[]
}

const DEFAULT_PRESETS: { label: string; value: CalendarPresetValue }[] = [
  { label: 'Last 7 days', value: 'last7Days' },
  { label: 'Last 14 days', value: 'last14Days' },
  { label: 'Last 30 days', value: 'last30Days' },
  { label: 'This month', value: 'thisMonth' },
]

// ───────────────── BLOCK 3: Date Formatting ────────────────────
// Uses Intl.DateTimeFormat — zero dependency, locale-aware
const dateFmt = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatCalendarValue(
  value: CalendarValue | undefined,
  placeholder: string
): string {
  if (!value) return placeholder

  if (value instanceof Date) return dateFmt.format(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return placeholder
    if (value.length === 1) return dateFmt.format(value[0])
    return `${dateFmt.format(value[0])} +${value.length - 1} more`
  }

  if (typeof value === 'object' && 'from' in value) {
    const range = value as CalendarDateRange
    const from = dateFmt.format(range.from)
    const to = range.to ? dateFmt.format(range.to) : '...'
    return `${from} → ${to}`
  }

  return placeholder
}

// ───────────────── BLOCK 4: Component ──────────────────────────
export function DatePicker({
  value,
  onChange,
  selectionMode = 'single',
  placeholder = 'Pick a date',
  minDate,
  maxDate,
  disabledDates,
  weekStartsOn,
  fixedWeeks,
  disabled,
  className,
  presets,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const handleChange = useCallback(
    (newValue: CalendarValue) => {
      onChange?.(newValue)

      if (selectionMode === 'single') {
        setOpen(false)
      } else if (selectionMode === 'range') {
        if (
          newValue &&
          typeof newValue === 'object' &&
          'from' in newValue &&
          (newValue as CalendarDateRange).to
        ) {
          setOpen(false)
        }
      }
    },
    [onChange, selectionMode]
  )

  const effectivePresets =
    selectionMode === 'range' ? presets ?? DEFAULT_PRESETS : undefined

  const displayText = formatCalendarValue(value, placeholder)
  const hasValue = Boolean(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal gap-2 overflow-hidden',
            !hasValue && 'text-muted-foreground'
          )}
        >
          {/* Left group: icon + text (takes all available space) */}
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate min-w-0">{displayText}</span>
          </span>

          {/* Right: X clear button (only when value exists) */}
          {/* stopPropagation on pointerdown + click prevents the
              PopoverTrigger from firing — the Popover won't open/close */}
          {hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              className="flex items-center justify-center shrink-0 rounded-sm p-0.5 hover:bg-accent hover:text-accent-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleChange(undefined)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  e.preventDefault()
                  handleChange(undefined)
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          className={className}
          selectionMode={selectionMode}
          value={value}
          onChange={handleChange}
          minDate={minDate}
          maxDate={maxDate}
          disabledDates={disabledDates}
          weekStartsOn={weekStartsOn}
          fixedWeeks={fixedWeeks}
        >
          <div className="p-3">
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
            <CalendarFooter>
              <CalendarTodayTrigger />
              <div className="flex gap-2">
                {effectivePresets && effectivePresets.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs gap-1.5"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Presets
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {effectivePresets.map((preset) => (
                        <CalendarPresetTrigger
                          asChild
                          key={preset.value}
                          value={preset.value}
                        >
                          <DropdownMenuItem className="cursor-pointer">
                            {preset.label}
                          </DropdownMenuItem>
                        </CalendarPresetTrigger>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <CalendarClearTrigger />
              </div>
            </CalendarFooter>
          </div>
        </Calendar>
      </PopoverContent>
    </Popover>
  )
}

// ───────────────── BLOCK 5: Exports ────────────────────────────
// DatePicker is the only export — the Calendar sub-components are
// imported directly from '@/components/shared/calendar' when needed.