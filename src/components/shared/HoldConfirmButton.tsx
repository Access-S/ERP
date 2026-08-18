'use client'

// ───────────────── BLOCK 1: Imports ────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type VariantProps } from 'class-variance-authority'
import { Trash2, Check } from 'lucide-react'

// ───────────────── BLOCK 2: Types & Interfaces ─────────────────
type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

interface HoldConfirmButtonProps {
  onConfirm: () => void
  duration?: number
  children: React.ReactNode
  className?: string
  disabled?: boolean
  variant?: ButtonVariant
  fillClassName?: string
  icon?: React.ReactNode // Added back for static icon display
}

interface HoldConfirmIconButtonProps {
  onConfirm: () => void
  duration?: number
  icon?: React.ReactNode
  className?: string
  disabled?: boolean
  size?: number
  variant?: ButtonVariant
  'aria-label'?: string
}

interface HoldConfirmSwapButtonProps {
  onConfirm: () => void
  duration?: number
  children: React.ReactNode
  className?: string
  disabled?: boolean
  variant?: ButtonVariant
  icon: React.ReactNode
}

// ───────────────── BLOCK 3: Shared Hook ────────────────────────
type HoldStatus = 'idle' | 'holding' | 'done'

function useHoldProgress(
  duration: number,
  onConfirm: () => void,
  disabled?: boolean,
  retainDoneState: boolean = false
) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<HoldStatus>('idle')
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const confirmedRef = useRef(false)

  const onConfirmRef = useRef(onConfirm)
  const durationRef = useRef(duration)
  useEffect(() => { onConfirmRef.current = onConfirm }, [onConfirm])
  useEffect(() => { durationRef.current = duration }, [duration])

  const clearRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearRaf()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    startTimeRef.current = null
    setProgress(0)
    setStatus('idle')
    confirmedRef.current = false
  }, [clearRaf])

  const animate = useCallback(() => {
    if (startTimeRef.current === null) return

    const elapsed = Date.now() - startTimeRef.current
    const newProgress = Math.min(elapsed / durationRef.current, 1)

    setProgress(newProgress)

    if (newProgress >= 1 && !confirmedRef.current) {
      confirmedRef.current = true
      setStatus('done')
      onConfirmRef.current()
      
      if (retainDoneState) {
        // Keep visual state at 100% for 1000ms to show tick animation
        clearRaf()
        timeoutRef.current = setTimeout(() => {
          reset()
        }, 1000)
      } else {
        // Instantly reset visual state, but keep confirmedRef true 
        // so it doesn't double-fire while user holds mouse down
        clearRaf()
        setProgress(0)
        setStatus('idle')
      }
      return
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [reset, retainDoneState])

  const start = useCallback(() => {
    if (disabled) return
    if (confirmedRef.current) return // Prevent starting if already completed and waiting for mouse up
    startTimeRef.current = Date.now()
    setStatus('holding')
    rafRef.current = requestAnimationFrame(animate)
  }, [disabled, animate])

  const stop = useCallback(() => {
    // If we are retaining the done state and it's confirmed, let the timeout handle the reset
    if (retainDoneState && confirmedRef.current) return 
    // Otherwise, reset immediately (handles early release, and post-completion release for fill-only)
    reset()
  }, [reset, retainDoneState])

  useEffect(() => {
    if (disabled) reset()
  }, [disabled, reset])

  useEffect(() => {
    return () => {
      clearRaf()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [clearRaf])

  return { progress, status, start, stop }
}

// ───────────────── BLOCK 4: Fill-Only Components ──────────────
export function HoldConfirmButton({
  onConfirm,
  duration = 1500,
  children,
  className,
  disabled = false,
  variant = 'secondary',
  fillClassName,
  icon,
}: HoldConfirmButtonProps) {
  const { progress, start, stop } = useHoldProgress(duration, onConfirm, disabled, false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      start()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      stop()
    }
  }

  const defaultFill = 
    variant === 'default' || variant === 'destructive' 
      ? 'bg-background/30' 
      : 'bg-primary'
      
  const computedFillClassName = fillClassName ?? defaultFill

  return (
    <Button
      type="button"
      variant={variant}
      className={cn(
        'relative overflow-hidden select-none touch-none motion-safe:transition-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className={cn(
          'absolute inset-0 origin-left motion-safe:transition-none',
          computedFillClassName
        )}
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {/* Render icon statically if provided */}
        {icon && (
          <span className="flex items-center justify-center">
            {icon}
          </span>
        )}
        {children}
      </span>
    </Button>
  )
}

export function HoldConfirmIconButton({
  onConfirm,
  duration = 1500,
  icon,
  className,
  disabled = false,
  size = 44,
  variant = 'outline',
  'aria-label': ariaLabel = 'Confirm action',
}: HoldConfirmIconButtonProps) {
  const { progress, start, stop } = useHoldProgress(duration, onConfirm, disabled, false)

  const padding = 4
  const strokeWidth = 3.5
  const ringSize = size - padding * 2
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      start()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      stop()
    }
  }

  return (
    <div
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
    >
      <Button
        type="button"
        variant={variant}
        size="icon"
        aria-label={ariaLabel}
        className={cn(
          'w-full h-full select-none touch-none motion-safe:transition-none',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="relative z-10 flex items-center justify-center">
          {icon || <Trash2 className="h-4 w-4" />}
        </span>
      </Button>

      <svg
        className="absolute pointer-events-none motion-safe:transition-all"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{ top: padding, left: padding }}
      >
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          className="stroke-border"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          className="stroke-primary"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
        />
      </svg>
    </div>
  )
}

// ───────────────── BLOCK 5: Swap-Only Component ───────────────
export function HoldConfirmSwapButton({
  onConfirm,
  duration = 1500,
  children,
  className,
  disabled = false,
  variant = 'secondary',
  icon,
}: HoldConfirmSwapButtonProps) {
  const { progress, status, start, stop } = useHoldProgress(duration, onConfirm, disabled, true)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      start()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      stop()
    }
  }

  const iconSize = 24
  const strokeWidth = 3.5
  const radius = (iconSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <Button
      type="button"
      variant={variant}
      className={cn(
        'relative overflow-hidden select-none touch-none motion-safe:transition-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon && (
          <span className="relative flex h-6 w-6 items-center justify-center">
            {/* Original Icon (only visible when idle) */}
            <span className={cn(
              'absolute flex h-6 w-6 items-center justify-center motion-safe:transition-opacity',
              status === 'idle' ? 'opacity-100' : 'opacity-0'
            )}>
              {icon}
            </span>

            {/* Progress Spinner (Hollow, 24px) */}
            {status === 'holding' && (
              <span className="absolute flex h-6 w-6 items-center justify-center">
                <svg 
                  className="h-full w-full motion-safe:transition-none" 
                  viewBox={`0 0 ${iconSize} ${iconSize}`}
                >
                  <circle
                    cx={iconSize / 2}
                    cy={iconSize / 2}
                    r={radius}
                    fill="none"
                    className="stroke-current opacity-30"
                    strokeWidth={strokeWidth}
                  />
                  <circle
                    cx={iconSize / 2}
                    cy={iconSize / 2}
                    r={radius}
                    fill="none"
                    className="stroke-current"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90 ${iconSize / 2} ${iconSize / 2})`}
                  />
                </svg>
              </span>
            )}

            {/* Success Tick with Circle Background */}
            {status === 'done' && (
              <span 
                className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-current motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-300"
              >
                <Check className="text-background scale-[0.9]" strokeWidth={3} />
              </span>
            )}
          </span>
        )}
        {children}
      </span>
    </Button>
  )
}