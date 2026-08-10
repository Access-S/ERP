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
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ShieldCheck, 
  User, 
  MousePointer2, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Settings,
  ArrowRight,
  DatabaseZap
} from "lucide-react"
import { HoldConfirmButton } from "@/components/shared/HoldConfirmButton"

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
type DialogLayer = 'base' | 'nested';

// ───────────────── BLOCK 3: Component ──────────────────────────
export default function PlaygroundPage() {
  const [activeLayer, setActiveLayer] = useState<DialogLayer>('base');
  const [isLoading, setIsLoading] = useState(false);

  const simulateLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="space-y-6 p-8 bg-background min-h-screen">
      <h1 className="text-4xl font-heading tracking-wider text-foreground uppercase tracking-tighter">UI PLAYGROUND</h1>

      {/* ─── SECTION 1: BUTTON ARSENAL ─── */}
      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-sans flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Button Arsenal
          </CardTitle>
          <CardDescription className="font-sans">
            Tactile primitives and friction-based safety actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Standard Variants */}
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Standard Variants</Label>
              <div className="grid gap-2">
                <Button variant="default">Primary Action</Button>
                <Button variant="success">Success / Approve</Button>
                <Button variant="outline">Outline / Neutral</Button>
                <Button variant="ghost">Ghost / Toolbar</Button>
              </div>
            </div>

             {/* Friction & Danger */}
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Friction & Safety</Label>
              <div className="grid gap-4">
                {/* Fix: Updated props to match HoldActionButton API */}
<HoldConfirmButton
  verb="Void" // That's it! Component handles "Hold to Void", "Voiding...", "Voided"
  pastTenseOverride="Voided" // Optional: Only needed if English is irregular (like Cancel -> Cancelled)
  holdTime={2000}
  onConfirm={async () => {
    toast.error("Purchase Order Voided", {
      description: "The transaction has been removed from the active ledger."
    })
  }}
/>
                <Button variant="destructive">Instant Delete (Risky)</Button>
                <Button variant="warning">Warning Override</Button>
              </div>
            </div>

            {/* Interactive States */}
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Async & Icons</Label>
              <div className="grid gap-2">
                <Button loading={isLoading} onClick={simulateLoading}>
                  {isLoading ? "Syncing Database" : "Test Async Flow"}
                </Button>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline"><Plus /></Button>
                  <Button size="icon" variant="outline"><DatabaseZap /></Button>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ─── SECTION 2: STACKED DIALOG ─── */}
      <Card className="max-w-2xl border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-sans flex items-center gap-2">
            <MousePointer2 className="h-5 w-5 text-primary" />
            Stacked Depth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog onOpenChange={(open) => !open && setActiveLayer('base')}>
            <DialogTrigger asChild>
              <Button variant="outline">
                Open Management Console
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogTrigger>

            <DialogContent 
              className={cn(
                "fixed left-[50%] top-[50%] z-50 w-full max-w-lg -translate-x-1/2 border-border/50 bg-card p-6 shadow-2xl transition-all duration-300 ease-in-out",
                activeLayer === 'nested' 
                  ? "!-translate-y-[calc(50%+60px)] scale-95 opacity-50 blur-[1px]" 
                  : "-translate-y-1/2 scale-100 opacity-100 blur-none"
              )}
            >
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <DialogTitle className="font-sans text-xl tracking-tight">System Identity</DialogTitle>
                </div>
              </DialogHeader>

              <div className="grid gap-6 py-8 text-left">
                <div className="flex justify-between items-center border-b border-border/40 pb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Access Level</p>
                    <p className="text-sm font-mono tracking-tighter uppercase text-primary">Super_User_01</p>
                  </div>
                  <Badge variant="outline" className="border-success/20 text-success bg-success/5 uppercase text-[10px]">
                    Verified
                  </Badge>
                </div>
              </div>

              <DialogFooter>
                <Dialog onOpenChange={(open) => setActiveLayer(open ? 'nested' : 'base')}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="w-full">
                      Edit Security Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[420px] border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-8 duration-300">
                    <DialogHeader>
                      <DialogTitle className="font-sans text-lg text-primary text-center">Update Details</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-6 text-left">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Legal Name</Label>
                        <Input defaultValue="Bora Baloglu" className="h-9 bg-background focus-visible:ring-primary/50" />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:flex-row-reverse">
                      <Button onClick={() => { setActiveLayer('base'); toast.success("Identity updated"); }}>
                        Save
                      </Button>
                      <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
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
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────