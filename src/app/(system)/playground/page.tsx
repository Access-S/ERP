// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner" // Sonner provides the Toast Arsenal logic
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ShieldCheck, 
  User, 
  MousePointer2, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Info 
} from "lucide-react"

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
type DialogLayer = 'base' | 'nested';

// ───────────────── BLOCK 3: Component ──────────────────────────
export default function PlaygroundPage() {
  const [activeLayer, setActiveLayer] = useState<DialogLayer>('base');

  /**
   * PROMISE TOAST ARSENAL
   * Fixed: Returns JSX elements instead of plain objects to resolve React child error.
   */
  const handleRunPromise = () => {
    toast.promise(
      new Promise((resolve, reject) => {
        setTimeout(() => {
          const success = Math.random() > 0.15;
          if (success) resolve({ name: "Security Audit Log" });
          else reject(new Error("Database write timeout"));
        }, 2000);
      }),
      {
        loading: (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-sm">Generating system event...</span>
            <span className="text-xs text-muted-foreground">Writing to audit ledger, please hold.</span>
          </div>
        ),
        success: (data: any) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">Event generated!</span>
            <span className="text-xs text-muted-foreground">{data.name} created successfully.</span>
          </div>
        ),
        error: (err: any) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-sm text-destructive">Error generating event</span>
            <span className="text-xs text-muted-foreground">{err.message || "Something went wrong."}</span>
          </div>
        ),
      }
    );
  };

  return (
    <div className="space-y-6 p-8 bg-background min-h-screen">
      <h1 className="text-4xl font-heading tracking-wider text-foreground uppercase tracking-tighter">UI PLAYGROUND</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ─── TOAST ARSENAL SECTION ─── */}
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-sans flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Notification Arsenal
            </CardTitle>
            <CardDescription className="font-sans">
              System-wide alerts including asynchronous Promise states.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            
            <Button 
              variant="outline" 
              className="w-full justify-start font-sans" 
              onClick={handleRunPromise}
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Run Promise Toast
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="font-sans" 
                onClick={() => toast.success("Record Saved", { 
                  description: "Inventory counts updated." 
                })}
              >
                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                Success
              </Button>
              
              <Button 
                variant="destructive" 
                className="font-sans" 
                onClick={() => toast.error("Access Denied", { 
                  description: "Insufficient ERP permissions." 
                })}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Error
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* ─── STACKED DIALOG SECTION ─── */}
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-sans flex items-center gap-2">
              <MousePointer2 className="h-5 w-5 text-primary" />
              Stacked Card Depth
            </CardTitle>
            <CardDescription className="font-sans">
              Centered layering using state-driven depth transforms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog onOpenChange={(open) => !open && setActiveLayer('base')}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full font-sans">
                  <User className="mr-2 h-4 w-4" />
                  Manage User Profile
                </Button>
              </DialogTrigger>

              <DialogContent 
                className={cn(
                  "fixed left-[50%] top-[50%] z-50 w-full max-w-lg -translate-x-1/2 border-border/50 bg-card p-6 shadow-xl transition-all duration-300 ease-in-out",
                  activeLayer === 'nested' 
                    ? "!-translate-y-[calc(50%+60px)] scale-95 opacity-50 blur-[1px]" 
                    : "-translate-y-1/2 scale-100 opacity-100 blur-none"
                )}
              >
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <DialogTitle className="font-sans text-xl tracking-tight text-left">System Identity</DialogTitle>
                  </div>
                  <DialogDescription className="font-sans text-xs italic text-muted-foreground text-left">
                    Active Admin Session: B82-00X-991
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-6 text-left">
                  <div className="flex justify-between items-center border-b border-border/40 pb-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">User UUID</p>
                      <p className="text-sm font-mono tracking-tighter uppercase">bora-baloglu-id</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/5 uppercase text-[10px]">
                      Verified
                    </Badge>
                  </div>
                </div>

                <DialogFooter>
                  <Dialog onOpenChange={(open) => setActiveLayer(open ? 'nested' : 'base')}>
                    <DialogTrigger asChild>
                      <Button variant="default" className="w-full font-sans shadow-md">
                        Edit Profile Details
                      </Button>
                    </DialogTrigger>
                    
                    <DialogContent className="sm:max-w-[420px] border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-8 duration-300">
                      <DialogHeader>
                        <DialogTitle className="font-sans text-lg text-primary text-center uppercase tracking-tight">Modify Details</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-6 text-left">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Full Name</Label>
                          <Input defaultValue="Bora Baloglu" className="h-9 bg-background focus-visible:ring-primary/50" />
                        </div>
                      </div>
                      <DialogFooter className="gap-2 sm:flex-row-reverse">
                        <Button className="font-sans px-8" onClick={() => { setActiveLayer('base'); toast.success("Identity updated"); }}>
                          Save
                        </Button>
                        <DialogClose asChild>
                          <Button variant="ghost" className="font-sans">Cancel</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────