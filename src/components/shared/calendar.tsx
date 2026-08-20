'use client'

// ───────────────── BLOCK 1: Imports ────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  type CalendarDateRange,
  type CalendarPresetValue,
  type CalendarSelectionMode,
  type CalendarValue,
} from '@/types/calendar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

// ───────────────── BLOCK 2: Types & Interfaces ─────────────────
interface CalendarProps {
  children: React.ReactNode
  className?: string
  selectionMode?: CalendarSelectionMode
  defaultValue?: CalendarValue
  value?: CalendarValue
  onChange?: (value: CalendarValue) => void
  minDate?: Date
  maxDate?: Date
  disabledDates?: Date[]
  weekStartsOn?: 0 | 1
  fixedWeeks?: boolean
}

interface CalendarContextValue {
  viewDate: Date
  setViewDate: (date: Date) => void
  selected: CalendarValue
  selectDate: (date: Date) => void
  clearSelection: () => void
  hoverDate?: Date
  setHoverDate: (date?: Date) => void
  selectionMode: CalendarSelectionMode
  minDate?: Date
  maxDate?: Date
  disabledDates: Date[]
  weekStartsOn: 0 | 1
  fixedWeeks: boolean
  applyPreset: (preset: CalendarPresetValue) => void
  today?: Date
  focusedDate?: Date
  setFocusedDate: (date: Date) => void
  slideDir: 'left' | 'right' | null
}

interface DayCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  isDisabled: boolean
  isSelected: boolean
  isRangeStart: boolean
  isRangeEnd: boolean
  isInRange: boolean
  isFocused: boolean
  isHoveredEnd: boolean
  selectionMode: CalendarSelectionMode
  onSelect: (date: Date) => void
  onHoverChange: (date: Date | undefined) => void
}

// ───────────────── BLOCK 3: Date Utilities ─────────────────────
function normalizeDate(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 0): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// ── Clamp helpers: prevent JS Date overflow ──
// Jan 31 + 1 month → Feb 31 → Mar 3 (overflow). These detect
// the overflow (getDate() < targetDay) and clamp to month end
// via setDate(0) which means "last day of previous month".
function setMonthClamped(date: Date, month: number): Date {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setMonth(month)
  if (d.getDate() < targetDay) {
    d.setDate(0)
  }
  d.setHours(0, 0, 0, 0)
  return d
}

function setFullYearClamped(date: Date, year: number): Date {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setFullYear(year)
  if (d.getDate() < targetDay) {
    d.setDate(0)
  }
  d.setHours(0, 0, 0, 0)
  return d
}

function addMonths(date: Date, amount: number): Date {
  return setMonthClamped(date, date.getMonth() + amount)
}

function addDays(date: Date, amount: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function isSameMonth(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
}

function isBefore(d1: Date, d2: Date): boolean {
  return d1.getTime() < d2.getTime()
}

function isAfter(d1: Date, d2: Date): boolean {
  return d1.getTime() > d2.getTime()
}

function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
  const t = date.getTime()
  return t >= interval.start.getTime() && t <= interval.end.getTime()
}

// ── fixedWeeks: true → always 42 days (6 rows, stable height) ──
// ── fixedWeeks: false → 28/35/42 dynamically (compact February) ──
function getCalendarDays(
  viewDate: Date,
  weekStartsOn: 0 | 1 = 0,
  fixedWeeks = true
): Date[] {
  const start = startOfMonth(viewDate)
  const end = endOfMonth(viewDate)
  const startWeek = startOfWeek(start, weekStartsOn)
  const days: Date[] = []
  let current = new Date(startWeek)

  if (fixedWeeks) {
    while (days.length < 42) {
      days.push(new Date(current))
      current = addDays(current, 1)
    }
  } else {
    while (true) {
      days.push(new Date(current))
      current = addDays(current, 1)
      // Stop after passing end of month AND completing a full week
      if (isAfter(current, end) && days.length % 7 === 0) {
        break
      }
    }
  }
  return days
}

function getWeekdays(weekStartsOn: 0 | 1 = 0): { short: string; full: string }[] {
  const days = [
    { short: 'Su', full: 'Sunday' },
    { short: 'Mo', full: 'Monday' },
    { short: 'Tu', full: 'Tuesday' },
    { short: 'We', full: 'Wednesday' },
    { short: 'Th', full: 'Thursday' },
    { short: 'Fr', full: 'Friday' },
    { short: 'Sa', full: 'Saturday' },
  ]
  if (weekStartsOn === 1) return [...days.slice(1), days[0]]
  return days
}

// ───────────────── BLOCK 4: Calendar Context & Provider ────────
const CalendarContext = React.createContext<CalendarContextValue | null>(null)

function useCalendar() {
  const ctx = React.useContext(CalendarContext)
  if (!ctx) throw new Error('Calendar sub-components must be used inside <Calendar>')
  return ctx
}

function CalendarProvider({
  children,
  selectionMode = 'single',
  defaultValue,
  value: controlledValue,
  onChange,
  minDate,
  maxDate,
  disabledDates = [],
  weekStartsOn = 0,
  fixedWeeks = true,
}: Omit<CalendarProps, 'className'>) { // FIX: Removed 'children' from Omit
  const isControlled = controlledValue !== undefined

  const normalizedMinDate = useMemo(
    () => (minDate ? normalizeDate(minDate) : undefined),
    [minDate]
  )
  const normalizedMaxDate = useMemo(
    () => (maxDate ? normalizeDate(maxDate) : undefined),
    [maxDate]
  )
  const normalizedDisabledDates = useMemo(
    () => disabledDates.map((d) => normalizeDate(d)),
    [disabledDates]
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (
        normalizedMinDate &&
        normalizedMaxDate &&
        isAfter(normalizedMinDate, normalizedMaxDate)
      ) {
        console.warn(
          'Calendar: minDate is after maxDate. All dates will be disabled.'
        )
      }
    }
  }, [normalizedMinDate, normalizedMaxDate])

  const [selected, setSelected] = useState<CalendarValue>(defaultValue)
  const [viewDate, setViewDate] = useState<Date>(() => {
    const initial = isControlled ? controlledValue : defaultValue
    if (initial instanceof Date) return normalizeDate(initial)
    if (Array.isArray(initial) && initial.length > 0)
      return normalizeDate(initial[0])
    if (initial && typeof initial === 'object' && 'from' in initial)
      return normalizeDate(initial.from)
    return normalizeDate(new Date())
  })

  const [today, setToday] = useState<Date | undefined>()
  const [focusedDate, setFocusedDate] = useState<Date | undefined>()
  const [hoverDate, setHoverDate] = useState<Date | undefined>()
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const currentSelected = isControlled ? controlledValue : selected
  const currentSelectedRef = useRef(currentSelected)
  currentSelectedRef.current = currentSelected

  const viewDateRef = useRef(viewDate)
  viewDateRef.current = viewDate

  // ── Defensive setters (stable identity) ──
  // Only set slideDir when month actually changes — prevents
  // unnecessary remount/animation when navigating within same month
  // (e.g. clicking Today while already viewing today's month)
  const handleSetViewDate = useCallback((date: Date) => {
    const normalized = normalizeDate(date)
    if (!isSameMonth(normalized, viewDateRef.current)) {
      setSlideDir(normalized > viewDateRef.current ? 'right' : 'left')
    }
    setViewDate(normalized)
  }, [])

  const handleSetHoverDate = useCallback((date?: Date) => {
    setHoverDate(date ? normalizeDate(date) : undefined)
  }, [])

  const handleSetFocusedDate = useCallback((date: Date) => {
    setFocusedDate(normalizeDate(date))
  }, [])

  // ── Clear selection (Today/Clear buttons) ──
  const clearSelection = useCallback(() => {
    setSelected(undefined)
    setHoverDate(undefined)
    onChangeRef.current?.(undefined)
  }, [])

  // ── SSR-safe today + focusedDate initialization ──
  useEffect(() => {
    const now = normalizeDate(new Date())
    setToday(now)

    setFocusedDate((prev) => {
      if (prev) return prev
      const sel = currentSelectedRef.current
      if (sel instanceof Date) return normalizeDate(sel)
      if (Array.isArray(sel) && sel.length > 0) return normalizeDate(sel[0])
      if (sel && typeof sel === 'object' && 'from' in sel && sel.from)
        return normalizeDate(sel.from)
      return now
    })
  }, [])

  // ── Sync viewDate when controlled value changes externally ──
  useEffect(() => {
    if (!isControlled || !controlledValue) return

    let incomingDate: Date | undefined
    if (controlledValue instanceof Date) {
      incomingDate = controlledValue
    } else if (Array.isArray(controlledValue) && controlledValue.length > 0) {
      incomingDate = controlledValue[0]
    } else if (
      controlledValue &&
      typeof controlledValue === 'object' &&
      'from' in controlledValue &&
      controlledValue.from
    ) {
      incomingDate = controlledValue.from
    }

    if (incomingDate) {
      const normalized = normalizeDate(incomingDate)
      if (!isSameMonth(viewDateRef.current, normalized)) {
        setSlideDir(normalized > viewDateRef.current ? 'right' : 'left')
      }
      setViewDate((prev) =>
        isSameMonth(prev, normalized) ? prev : normalized
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, controlledValue])

  // ── Stable selectDate ──
  const selectDate = useCallback(
    (date: Date) => {
      const normalizedDate = normalizeDate(date)
      setFocusedDate(normalizedDate)
      const current = currentSelectedRef.current

      if (selectionMode === 'single') {
        if (!isControlled) setSelected(normalizedDate)
        onChangeRef.current?.(normalizedDate)
      } else if (selectionMode === 'range') {
        const range =
          current &&
          typeof current === 'object' &&
          'from' in current
            ? (current as CalendarDateRange)
            : undefined

        if (!range || range.to) {
          const newRange: CalendarDateRange = { from: normalizedDate }
          if (!isControlled) setSelected(newRange)
          onChangeRef.current?.(newRange)
        } else {
          let from = normalizeDate(range.from)
          let to = normalizedDate
          if (isBefore(to, from)) [from, to] = [to, from]
          const newRange: CalendarDateRange = { from, to }
          if (!isControlled) setSelected(newRange)
          onChangeRef.current?.(newRange)
        }
      } else {
        const arr = (current as Date[] | undefined) || []
        const exists = arr.some((d) => isSameDay(d, normalizedDate))
        const newArr = exists
          ? arr.filter((d) => !isSameDay(d, normalizedDate))
          : [...arr, normalizedDate]
        if (!isControlled) setSelected(newArr)
        onChangeRef.current?.(newArr)
      }
    },
    [isControlled, selectionMode]
  )

  const applyPreset = useCallback(
    (preset: CalendarPresetValue) => {
      if (selectionMode !== 'range') {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'Calendar: applyPreset is only supported in range selection mode'
          )
        }
        return
      }

      const now = normalizeDate(new Date())
      let from: Date
      let to: Date = now

      switch (preset) {
        case 'last7Days':
          from = addDays(now, -6)
          break
        case 'last14Days':
          from = addDays(now, -13)
          break
        case 'last30Days':
          from = addDays(now, -29)
          break
        case 'thisMonth':
          from = startOfMonth(now)
          to = endOfMonth(now)
          break
      }

      if (normalizedMinDate && isBefore(from, normalizedMinDate))
        from = normalizedMinDate
      if (normalizedMaxDate && isAfter(to, normalizedMaxDate))
        to = normalizedMaxDate

      if (normalizedMinDate && isBefore(to, normalizedMinDate)) return
      if (normalizedMaxDate && isAfter(from, normalizedMaxDate)) return

      if (isBefore(to, from)) [from, to] = [to, from]

      const range: CalendarDateRange = { from, to }
      if (!isControlled) setSelected(range)
      handleSetViewDate(from)
      handleSetFocusedDate(from)
      onChangeRef.current?.(range)
    },
    [isControlled, selectionMode, normalizedMinDate, normalizedMaxDate, handleSetViewDate, handleSetFocusedDate]
  )

  // ── Memoized context value ──
  const contextValue = useMemo<CalendarContextValue>(
    () => ({
      viewDate,
      setViewDate: handleSetViewDate,
      selected: currentSelected,
      selectDate,
      clearSelection,
      hoverDate,
      setHoverDate: handleSetHoverDate,
      selectionMode,
      minDate: normalizedMinDate,
      maxDate: normalizedMaxDate,
      disabledDates: normalizedDisabledDates,
      weekStartsOn,
      fixedWeeks,
      applyPreset,
      today,
      focusedDate,
      setFocusedDate: handleSetFocusedDate,
      slideDir,
    }),
    [
      viewDate,
      currentSelected,
      hoverDate,
      today,
      focusedDate,
      slideDir,
      selectDate,
      clearSelection,
      handleSetViewDate,
      handleSetHoverDate,
      handleSetFocusedDate,
      selectionMode,
      normalizedMinDate,
      normalizedMaxDate,
      normalizedDisabledDates,
      weekStartsOn,
      fixedWeeks,
      applyPreset,
    ]
  )

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  )
}

// ───────────────── BLOCK 5: Calendar Root Component ────────────
export function Calendar({
  children,
  className,
  ...props
}: CalendarProps) {
  return (
    <CalendarProvider {...props}>
      <div className={cn('inline-block', className)} data-slot="calendar">
        {children}
      </div>
    </CalendarProvider>
  )
}

// ───────────────── BLOCK 6: Navigation Components ──────────────
export function CalendarViewControl({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('flex items-center justify-between gap-1 mb-4', className)}
      data-slot="calendar-view-control"
    >
      {children}
    </div>
  )
}

export function CalendarPrevTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { viewDate, setViewDate } = useCalendar()
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Previous month"
      className={cn('h-9 w-9 cursor-pointer', className)}
      data-slot="calendar-prev-trigger"
      onClick={() => setViewDate(addMonths(viewDate, -1))}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  )
}

export function CalendarNextTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { viewDate, setViewDate } = useCalendar()
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Next month"
      className={cn('h-9 w-9 cursor-pointer', className)}
      data-slot="calendar-next-trigger"
      onClick={() => setViewDate(addMonths(viewDate, 1))}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  )
}

export function CalendarMonthSelect({ className }: { className?: string }) {
  const { viewDate, setViewDate } = useCalendar()
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <Select
      value={String(viewDate.getMonth())}
      onValueChange={(v) => {
        setViewDate(setMonthClamped(viewDate, parseInt(v)))
      }}
    >
      <SelectTrigger
        className={cn('w-[120px] h-9 text-xs cursor-pointer', className)}
        data-slot="calendar-month-select"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" side="bottom" sideOffset={4}>
        {months.map((m, i) => (
          <SelectItem key={i} value={String(i)} className="text-xs cursor-pointer">
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CalendarYearSelect({ className }: { className?: string }) {
  const { viewDate, setViewDate, today, minDate, maxDate } = useCalendar()
  const currentYear = viewDate.getFullYear()

  const years = useMemo(() => {
    const baseYear = today?.getFullYear() ?? 2000
    const minYear = minDate?.getFullYear() ?? baseYear - 50
    const maxYear = maxDate?.getFullYear() ?? baseYear + 10
    return Array.from(
      { length: maxYear - minYear + 1 },
      (_, i) => minYear + i
    )
  }, [today, minDate, maxDate])

  return (
    <Select
      value={String(currentYear)}
      onValueChange={(v) => {
        setViewDate(setFullYearClamped(viewDate, parseInt(v)))
      }}
    >
      <SelectTrigger
        className={cn('w-[80px] h-9 text-xs cursor-pointer', className)}
        data-slot="calendar-year-select"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" side="bottom" sideOffset={4}>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)} className="text-xs cursor-pointer">
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── Footer + Today/Clear triggers ──

export function CalendarFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('flex items-center justify-between gap-2 mt-4', className)}
      data-slot="calendar-footer"
    >
      {children}
    </div>
  )
}

export function CalendarTodayTrigger({
  className,
  disabled: disabledProp,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { today, setViewDate, setFocusedDate } = useCalendar()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Go to today"
      disabled={!today || disabledProp}
      className={cn('h-9 text-xs cursor-pointer', className)}
      data-slot="calendar-today-trigger"
      {...props}
      onClick={(e) => {
        if (today) {
          setViewDate(today)
          setFocusedDate(today)
        }
        props.onClick?.(e)
      }}
    >
      Today
    </Button>
  )
}

export function CalendarClearTrigger({
  className,
  disabled: disabledProp,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { selected, clearSelection } = useCalendar()

  // Check all three selection modes for a non-empty value
  const hasValue = selected
    ? selected instanceof Date
      ? true
      : Array.isArray(selected)
        ? selected.length > 0
        : typeof selected === 'object' && 'from' in selected
          ? !!selected.from
          : false
    : false

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Clear selection"
      disabled={!hasValue || disabledProp}
      className={cn('h-9 text-xs cursor-pointer', className)}
      data-slot="calendar-clear-trigger"
      {...props}
      onClick={(e) => {
        clearSelection()
        props.onClick?.(e)
      }}
    >
      Clear
    </Button>
  )
}

// ───────────────── BLOCK 7: Table Components ───────────────────
export function CalendarTable({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('w-full', className)}
      role="grid"
      aria-label="Calendar"
      data-slot="calendar-table"
    >
      {children}
    </div>
  )
}

export function CalendarWeekDays({ className }: { className?: string }) {
  const { weekStartsOn } = useCalendar()
  const weekdays = getWeekdays(weekStartsOn)

  return (
    <div
      className={cn(
        'grid grid-cols-7 mb-1 max-w-[calc(7_*_var(--cell-size,2.75rem))] mx-auto',
        className
      )}
      role="row"
      data-slot="calendar-week-days"
    >
      {weekdays.map((day) => (
        <div
          key={day.short}
          className="text-center text-xs font-medium text-muted-foreground py-1"
          role="columnheader"
        >
          <abbr title={day.full} aria-label={day.full} className="no-underline">
            {day.short}
          </abbr>
        </div>
      ))}
    </div>
  )
}

// ── Pure function: computes all boolean flags for a single day ──
function computeDayState(
  date: Date,
  ctx: {
    viewDate: Date
    selected: CalendarValue
    selectionMode: CalendarSelectionMode
    hoverDate?: Date
    minDate?: Date
    maxDate?: Date
    disabledSet: Set<string>
    today?: Date
    focusedDate?: Date
  }
) {
  const {
    viewDate,
    selected,
    selectionMode,
    hoverDate,
    minDate,
    maxDate,
    disabledSet,
    today,
    focusedDate,
  } = ctx

  const isCurrentMonth = isSameMonth(date, viewDate)
  const isToday = today ? isSameDay(date, today) : false
  const isFocused = focusedDate ? isSameDay(date, focusedDate) : false
  const dateKey = formatDateKey(date)
  const isDisabled =
    (minDate && isBefore(date, minDate)) ||
    (maxDate && isAfter(date, maxDate)) ||
    disabledSet.has(dateKey)

  let isSelected = false
  let isRangeStart = false
  let isRangeEnd = false
  let isInRange = false
  let isHoveredEnd = false

  if (selectionMode === 'single' && selected instanceof Date) {
    isSelected = isSameDay(date, selected)
  } else if (
    selectionMode === 'range' &&
    selected &&
    typeof selected === 'object' &&
    'from' in selected
  ) {
    const range = selected as CalendarDateRange
    isRangeStart = isSameDay(date, range.from)
    isRangeEnd = range.to ? isSameDay(date, range.to) : false
    isSelected = isRangeStart || isRangeEnd

    if (range.to) {
      isInRange =
        isWithinInterval(date, { start: range.from, end: range.to }) &&
        !isSelected
    } else if (hoverDate && !isSameDay(hoverDate, range.from)) {
      const isHoverAfter = isAfter(hoverDate, range.from)
      const previewStart = isHoverAfter ? range.from : hoverDate
      const previewEnd = isHoverAfter ? hoverDate : range.from
      isInRange =
        isWithinInterval(date, { start: previewStart, end: previewEnd }) &&
        !isSameDay(date, previewStart) &&
        !isSameDay(date, previewEnd)
      isHoveredEnd = isSameDay(date, hoverDate)
    }
  } else if (selectionMode === 'multiple' && Array.isArray(selected)) {
    isSelected = selected.some((d) => isSameDay(d, date))
  }

  return {
    isCurrentMonth,
    isToday,
    isDisabled,
    isSelected,
    isRangeStart,
    isRangeEnd,
    isInRange,
    isFocused,
    isHoveredEnd,
  }
}

// ── Memoized presentational component with roving tabindex ──
const DayCell = React.memo(function DayCell({
  date,
  isCurrentMonth,
  isToday,
  isDisabled,
  isSelected,
  isRangeStart,
  isRangeEnd,
  isInRange,
  isFocused,
  isHoveredEnd,
  selectionMode,
  onSelect,
  onHoverChange,
}: DayCellProps) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus()
    }
  }, [isFocused])

  return (
    <button
      ref={ref}
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      tabIndex={isFocused ? 0 : -1}
      data-slot="calendar-day"
      onClick={() => !isDisabled && onSelect(date)}
      onMouseEnter={() => selectionMode === 'range' && onHoverChange(date)}
      onMouseLeave={() => selectionMode === 'range' && onHoverChange(undefined)}
      className={cn(
        'relative flex items-center justify-center text-sm transition-colors cursor-pointer',
        'h-[var(--cell-size,2.75rem)] w-full',
        !isCurrentMonth && !isInRange && !isHoveredEnd && !isDisabled && 'text-muted-foreground opacity-40',
        isDisabled && 'opacity-50 cursor-not-allowed',
        isInRange && 'bg-primary/10 text-primary',
        isHoveredEnd && 'bg-primary/10 ring-2 ring-primary ring-inset rounded-md',
        isRangeStart && !isRangeEnd && 'bg-primary text-primary-foreground rounded-md rounded-r-none',
        isRangeEnd && !isRangeStart && 'bg-primary text-primary-foreground rounded-md rounded-l-none',
        isRangeStart && isRangeEnd && 'bg-primary text-primary-foreground rounded-md',
        isSelected && !isRangeStart && !isRangeEnd && 'bg-primary text-primary-foreground rounded-md',
        !isSelected && !isInRange && !isHoveredEnd && !isDisabled && 'hover:bg-accent hover:text-accent-foreground rounded-md'
      )}
    >
      {date.getDate()}
      {isToday && !isSelected && !isInRange && !isDisabled && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary shadow-[0_0_12px_3px_hsl(var(--primary))]" />
      )}
    </button>
  )
})

export function CalendarTableDays({ className }: { className?: string }) {
  const {
    viewDate,
    weekStartsOn,
    fixedWeeks,
    selected,
    selectionMode,
    selectDate,
    hoverDate,
    setHoverDate,
    minDate,
    maxDate,
    disabledDates,
    today,
    focusedDate,
    setFocusedDate,
    setViewDate,
    slideDir,
  } = useCalendar()

  const days = useMemo(
    () => getCalendarDays(viewDate, weekStartsOn, fixedWeeks),
    [viewDate, weekStartsOn, fixedWeeks]
  )

  const disabledSet = useMemo(
    () => new Set(disabledDates.map((d) => formatDateKey(d))),
    [disabledDates]
  )

  // ── Slide animation only when slideDir is set ──
  // slideDir starts as null (no animation on initial mount / Popover open).
  // handleSetViewDate sets it to 'left' or 'right' only when the month
  // actually changes. When the Popover closes and reopens, the CalendarProvider
  // remounts → slideDir resets to null → no animation on reopen. ✓
  const slideClass = slideDir
    ? slideDir === 'left'
      ? 'motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-left-4 motion-safe:duration-200 motion-safe:ease-out'
      : 'motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-right-4 motion-safe:duration-200 motion-safe:ease-out'
    : ''

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focusedDate) return

    let newDate: Date | undefined

    switch (e.key) {
      case 'ArrowUp':
        newDate = addDays(focusedDate, -7)
        break
      case 'ArrowDown':
        newDate = addDays(focusedDate, 7)
        break
      case 'ArrowLeft':
        newDate = addDays(focusedDate, -1)
        break
      case 'ArrowRight':
        newDate = addDays(focusedDate, 1)
        break
      case 'Home': {
        const day = focusedDate.getDay()
        const offset = (day - weekStartsOn + 7) % 7
        newDate = addDays(focusedDate, -offset)
        break
      }
      case 'End': {
        const day = focusedDate.getDay()
        const offset = (day - weekStartsOn + 7) % 7
        newDate = addDays(focusedDate, 6 - offset)
        break
      }
      case 'PageUp':
        newDate = e.shiftKey
          ? setFullYearClamped(focusedDate, focusedDate.getFullYear() - 1)
          : addMonths(focusedDate, -1)
        break
      case 'PageDown':
        newDate = e.shiftKey
          ? setFullYearClamped(focusedDate, focusedDate.getFullYear() + 1)
          : addMonths(focusedDate, 1)
        break
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const focusedKey = formatDateKey(focusedDate)
        const isFocusedDisabled =
          (minDate && isBefore(focusedDate, minDate)) ||
          (maxDate && isAfter(focusedDate, maxDate)) ||
          disabledSet.has(focusedKey)
        if (!isFocusedDisabled) {
          selectDate(focusedDate)
        }
        return
      }
      default:
        return
    }

    if (newDate) {
      e.preventDefault()
      setFocusedDate(newDate)
      if (!isSameMonth(newDate, viewDate)) {
        setViewDate(newDate)
      }
    }
  }

  const monthKey = `${viewDate.getFullYear()}-${viewDate.getMonth()}`

  return (
    <div
      key={monthKey}
      className={cn(
        'grid grid-cols-7 max-w-[calc(7_*_var(--cell-size,2.75rem))] mx-auto',
        slideClass,
        className
      )}
      role="row"
      onKeyDown={handleKeyDown}
      data-slot="calendar-table-days"
    >
      {days.map((date) => {
        const state = computeDayState(date, {
          viewDate,
          selected,
          selectionMode,
          hoverDate,
          minDate,
          maxDate,
          disabledSet,
          today,
          focusedDate,
        })

        return (
          <DayCell
            key={formatDateKey(date)}
            date={date}
            isCurrentMonth={state.isCurrentMonth}
            isToday={state.isToday}
            isDisabled={state.isDisabled}
            isSelected={state.isSelected}
            isRangeStart={state.isRangeStart}
            isRangeEnd={state.isRangeEnd}
            isInRange={state.isInRange}
            isFocused={state.isFocused}
            isHoveredEnd={state.isHoveredEnd}
            selectionMode={selectionMode}
            onSelect={selectDate}
            onHoverChange={setHoverDate}
          />
        )
      })}
    </div>
  )
}

// ───────────────── BLOCK 8: Preset Component ───────────────────
interface CalendarPresetTriggerProps {
  children: React.ReactNode
  value: CalendarPresetValue
  asChild?: boolean
  className?: string
}

export function CalendarPresetTrigger({
  children,
  value,
  asChild,
  className,
  ...props
}: CalendarPresetTriggerProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { applyPreset } = useCalendar()
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      {...(asChild ? {} : { type: 'button' as const })}
      className={cn('cursor-pointer', className)}
      data-slot="calendar-preset-trigger"
      {...props}
      onClick={(e) => {
        applyPreset(value)
        props.onClick?.(e)
      }}
    >
      {children}
    </Comp>
  )
}
