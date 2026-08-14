'use client'

// ───────────────── BLOCK 1: Imports ────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react'
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
}

interface CalendarContextValue {
  viewDate: Date
  setViewDate: (date: Date) => void
  selected: CalendarValue
  selectDate: (date: Date) => void
  hoverDate?: Date
  setHoverDate: (date?: Date) => void
  selectionMode: CalendarSelectionMode
  minDate?: Date
  maxDate?: Date
  disabledDates: Date[]
  weekStartsOn: 0 | 1
  applyPreset: (preset: CalendarPresetValue) => void
}

// ───────────────── BLOCK 3: Date Utilities ─────────────────────
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

function addMonths(date: Date, amount: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + amount)
  return d
}

function addDays(date: Date, amount: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
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

function getCalendarDays(viewDate: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfMonth(viewDate)
  const end = endOfMonth(viewDate)
  const startWeek = startOfWeek(start, weekStartsOn)
  const days: Date[] = []
  let current = new Date(startWeek)

  while (isBefore(current, startWeek) || days.length < 42) {
    days.push(new Date(current))
    current = addDays(current, 1)
    if (days.length >= 42 && isAfter(current, end)) break
  }
  return days
}

function getWeekdays(weekStartsOn: 0 | 1 = 0): string[] {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
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
}: Omit<CalendarProps, 'className' | 'children'>) {
  const isControlled = controlledValue !== undefined
  const [selected, setSelected] = useState<CalendarValue>(defaultValue)
  const [viewDate, setViewDate] = useState<Date>(() => {
    const initial = isControlled ? controlledValue : defaultValue
    if (initial instanceof Date) return initial
    if (Array.isArray(initial) && initial.length > 0) return initial[0]
    if (initial && typeof initial === 'object' && 'from' in initial) return initial.from
    return new Date()
  })
  const [hoverDate, setHoverDate] = useState<Date | undefined>()

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const currentSelected = isControlled ? controlledValue : selected

  const selectDate = useCallback(
    (date: Date) => {
      if (selectionMode === 'single') {
        if (!isControlled) setSelected(date)
        onChangeRef.current?.(date)
      } else if (selectionMode === 'range') {
        const range = currentSelected && typeof currentSelected === 'object' && 'from' in currentSelected
          ? (currentSelected as CalendarDateRange)
          : undefined

        if (!range || range.to) {
          const newRange: CalendarDateRange = { from: date }
          if (!isControlled) setSelected(newRange)
          onChangeRef.current?.(newRange)
        } else {
          let from = range.from
          let to = date
          if (isBefore(to, from)) [from, to] = [to, from]
          const newRange: CalendarDateRange = { from, to }
          if (!isControlled) setSelected(newRange)
          onChangeRef.current?.(newRange)
        }
      } else {
        const arr = (currentSelected as Date[] | undefined) || []
        const exists = arr.some((d) => isSameDay(d, date))
        const newArr = exists ? arr.filter((d) => !isSameDay(d, date)) : [...arr, date]
        if (!isControlled) setSelected(newArr)
        onChangeRef.current?.(newArr)
      }
    },
    [isControlled, currentSelected, selectionMode]
  )

  const applyPreset = useCallback(
    (preset: CalendarPresetValue) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let from: Date
      let to: Date = today

      switch (preset) {
        case 'last7Days':
          from = addDays(today, -6)
          break
        case 'last14Days':
          from = addDays(today, -13)
          break
        case 'last30Days':
          from = addDays(today, -29)
          break
        case 'thisMonth':
          from = startOfMonth(today)
          to = endOfMonth(today)
          break
      }

      const range: CalendarDateRange = { from, to }
      if (!isControlled) setSelected(range)
      setViewDate(from)
      onChangeRef.current?.(range)
    },
    [isControlled]
  )

  return (
    <CalendarContext.Provider
      value={{
        viewDate,
        setViewDate,
        selected: currentSelected,
        selectDate,
        hoverDate,
        setHoverDate,
        selectionMode,
        minDate,
        maxDate,
        disabledDates,
        weekStartsOn,
        applyPreset,
      }}
    >
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
      <div className={cn('inline-block', className)}>{children}</div>
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
    <div className={cn('flex items-center justify-between gap-1 mb-4', className)}>
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
      className={cn('h-7 w-7 cursor-pointer', className)}
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
      className={cn('h-7 w-7 cursor-pointer', className)}
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
        const d = new Date(viewDate)
        d.setMonth(parseInt(v))
        setViewDate(d)
      }}
    >
      <SelectTrigger className={cn('w-[120px] h-7 text-xs cursor-pointer', className)}>
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
  const { viewDate, setViewDate } = useCalendar()
  const currentYear = viewDate.getFullYear()
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i)

  return (
    <Select
      value={String(currentYear)}
      onValueChange={(v) => {
        const d = new Date(viewDate)
        d.setFullYear(parseInt(v))
        setViewDate(d)
      }}
    >
      <SelectTrigger className={cn('w-[80px] h-7 text-xs cursor-pointer', className)}>
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

// ───────────────── BLOCK 7: Table Components ───────────────────
export function CalendarTable({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('w-full', className)} role="grid">
      {children}
    </div>
  )
}

export function CalendarWeekDays({ className }: { className?: string }) {
  const { weekStartsOn } = useCalendar()
  const weekdays = getWeekdays(weekStartsOn)

  return (
    <div className={cn('grid grid-cols-7 mb-1', className)} role="row">
      {weekdays.map((day) => (
        <div
          key={day}
          className="text-center text-xs font-medium text-muted-foreground py-1"
          role="columnheader"
        >
          {day}
        </div>
      ))}
    </div>
  )
}

function DayCell({ date }: { date: Date }) {
  const {
    viewDate,
    selected,
    selectionMode,
    selectDate,
    hoverDate,
    setHoverDate,
    minDate,
    maxDate,
    disabledDates,
  } = useCalendar()

  const isCurrentMonth = isSameMonth(date, viewDate)
  const isToday = isSameDay(date, new Date())
  const isDisabled =
    (minDate && isBefore(date, minDate)) ||
    (maxDate && isAfter(date, maxDate)) ||
    disabledDates.some((d) => isSameDay(d, date))

  let isSelected = false
  let isRangeStart = false
  let isRangeEnd = false
  let isInRange = false

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
      const start = range.from
      const end = hoverDate
      if (isAfter(end, start)) {
        isInRange =
          isWithinInterval(date, { start, end }) && !isSameDay(date, start)
      }
    }
  } else if (selectionMode === 'multiple' && Array.isArray(selected)) {
    isSelected = selected.some((d) => isSameDay(d, date))
  }

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected || isInRange}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      tabIndex={isCurrentMonth ? 0 : -1}
      onClick={() => !isDisabled && selectDate(date)}
      onMouseEnter={() => selectionMode === 'range' && setHoverDate(date)}
      onMouseLeave={() => selectionMode === 'range' && setHoverDate(undefined)}
      className={cn(
        'relative flex items-center justify-center text-sm transition-colors cursor-pointer',
        'h-[var(--cell-size,2rem)] w-[var(--cell-size,2rem)]',
        !isCurrentMonth && 'text-muted-foreground opacity-50',
        isDisabled && 'opacity-50 cursor-not-allowed',
        isToday && !isSelected && !isInRange && 'border border-primary',
        isInRange && 'bg-primary/10 text-primary rounded-none',
        isRangeStart && !isRangeEnd && 'bg-primary text-primary-foreground rounded-md rounded-r-none',
        isRangeEnd && !isRangeStart && 'bg-primary text-primary-foreground rounded-md rounded-l-none',
        isRangeStart && isRangeEnd && 'bg-primary text-primary-foreground rounded-md',
        isSelected && !isRangeStart && !isRangeEnd && 'bg-primary text-primary-foreground rounded-md',
        !isSelected && !isInRange && !isDisabled && 'hover:bg-accent hover:text-accent-foreground rounded-md'
      )}
    >
      {date.getDate()}
    </button>
  )
}

export function CalendarTableDays({ className }: { className?: string }) {
  const { viewDate, weekStartsOn } = useCalendar()
  const days = getCalendarDays(viewDate, weekStartsOn)

  return (
    <div className={cn('grid grid-cols-7', className)}>
      {days.map((date, i) => (
        <DayCell key={i} date={date} />
      ))}
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
      type="button"
      className={cn('cursor-pointer', className)}
      {...props}
      onClick={(e) => {
        applyPreset(value)
        props.onClick?.(e as React.MouseEvent<HTMLButtonElement>)
      }}
    >
      {children}
    </Comp>
  )
}

// ───────────────── BLOCK 9: Exports ────────────────────────────
export { useCalendar }