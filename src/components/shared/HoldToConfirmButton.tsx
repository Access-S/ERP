// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2 } from "lucide-react"

// ───────────────── BLOCK 2: Types ──────────────────────────────
interface HoldToConfirmProps {
  onConfirm: () => void
  label?: string
  variant?: "destructive" | "warning" | "default"
  holdTime?: number // in milliseconds
  className?: string
}

// ───────────────── BLOCK 3: Component ──────────────────────────
export function HoldToConfirmButton({
  onConfirm,
  label = "Hold to Confirm",
  variant = "destructive",
  holdTime = 1500,
  className
}: HoldToConfirmProps) {
  const [progress, setProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const startHold = () => {
    setIsHolding(true)
    startTimeRef.current = Date.now()
    
    // We use a small interval to update the visual "jar filling" progress
    const interval = 10
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const newProgress = Math.min((elapsed / holdTime) * 100, 100)
      
      setProgress(newProgress)

      if (newProgress >= 100) {
        completeHold()
      }
    }, interval)
  }

  const stopHold = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsHolding(false)
    setProgress(0)
  }

  const completeHold = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsHolding(false)
    setProgress(0)
    onConfirm()
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <Button
      variant={variant}
      className={cn(
        "relative overflow-hidden transition-all active:scale-100", // Disable scale animation to keep jar stable
        isHolding && "brightness-110 shadow-inner",
        className
      )}
      // Mouse and Touch events to handle all devices
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
    >
      {/* 
        THE FILL LAYER:
        - absolute inset-0: Fills the button.
        - bg-white/20: Creates a "liquid" look on top of the destructive background.
      */}
      <div 
        className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none transition-all duration-75 ease-linear"
        style={{ width: `${progress}%` }}
      />

      {/* BUTTON CONTENT */}
      <div className="relative z-10 flex items-center gap-2 pointer-events-none">
        {isHolding ? (
          <AlertTriangle className="h-4 w-4 animate-pulse" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        <span className="font-sans uppercase text-[10px] font-bold tracking-widest">
          {isHolding ? "Keep Holding..." : label}
        </span>
      </div>
    </Button>
  )
}