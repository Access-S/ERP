// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Info,
  XCircle,
  AlertCircle,
  Bell,
  User,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  Send,
  CalendarDays,
  Clock,
  Loader2,
  Copy,
  Pencil,
  Eye,
  MoreHorizontal,
} from 'lucide-react'

// ─── UI Primitives ───
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
  CardAction,
} from '@/components/ui/card'
import {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertAction,
} from '@/components/ui/alert'
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

// ─── Shared Components ───
import {
  HoldConfirmButton,
  HoldConfirmIconButton,
} from '@/components/shared/HoldConfirmButton'
import { StackedDialogContent } from '@/components/shared/StackedDialog'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/shared/date-picker'

// ─── Table System ───
import {
  ColumnDef,
  SortingState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableToolbar,
  DataTableViewOptions,
} from '@/components/shared/data-table'
import { DataTableRowData } from '@/components/shared/data-table/types'

// ─── Types ───
import { type CalendarDateRange, type CalendarValue } from '@/types/calendar'

// ───────────────── BLOCK 2: Types & Demo Data ────────────────
interface ActionLog {
  id: number
  label: string
  timestamp: string
}

// Rule 5: Type safety for our table data
interface PurchaseOrder extends DataTableRowData {
  id: string
  supplier: string
  total: string
  status: 'Approved' | 'Pending' | 'Received' | 'Cancelled'
}

const presets = [
  { label: 'Last 7 days', value: 'last7Days' as const },
  { label: 'Last 14 days', value: 'last14Days' as const },
  { label: 'Last 30 days', value: 'last30Days' as const },
  { label: 'This month', value: 'thisMonth' as const },
] as const

const tableData: PurchaseOrder[] = [
  { id: 'PO-001', supplier: 'Acme Corp', total: '$12,450.00', status: 'Approved' },
  { id: 'PO-002', supplier: 'Global Parts', total: '$8,200.00', status: 'Pending' },
  { id: 'PO-003', supplier: 'SteelWorks', total: '$24,100.00', status: 'Received' },
  { id: 'PO-004', supplier: 'Fastener Inc', total: '$3,750.00', status: 'Cancelled' },
]

const scrollTags = Array.from({ length: 50 }, (_, i) => `v1.0.0-beta.${i}`)

// ───────────────── BLOCK 3: Page Component ───────────────────
export default function PlaygroundPage() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [nextId, setNextId] = useState(1)

  // ── Form States ──
  const [inputValue, setInputValue] = useState('')
  const [textareaValue, setTextareaValue] = useState('')
  const [selectValue, setSelectValue] = useState('')

  // ── Calendar States ──
  const [singleDate, setSingleDate] = useState<CalendarValue>(undefined)
  const [dateRange, setDateRange] = useState<CalendarValue>(undefined)

  // ── Dialog States ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nestedOpen, setNestedOpen] = useState(false)

  // ── Sheet State ──
  const [activeSheetSide, setActiveSheetSide] = useState<
    'left' | 'right' | 'top' | 'bottom' | null
  >(null)

  // ── Collapsible State ──
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)

  // ── Loading State ──
  const [isLoading, setIsLoading] = useState(false)

  // ── Table State ──
  const [sorting, setSorting] = useState<SortingState>([])

  const handleLog = useCallback((label: string) => {
    const now = new Date().toLocaleTimeString()
    setLogs((prev) => [{ id: nextId, label, timestamp: now }, ...prev])
    setNextId((id) => id + 1)
  }, [nextId])

  const clearLogs = () => {
    setLogs([])
    setNextId(1)
  }

  const triggerLoading = () => {
    setIsLoading(true)
    handleLog('Loading state triggered')
    setTimeout(() => setIsLoading(false), 2000)
  }

  const triggerToast = (type: 'success' | 'error' | 'info' | 'warning') => {
    const messages = {
      success: 'Purchase order approved successfully.',
      error: 'Failed to connect to inventory service.',
      info: 'MRP calculation queued for 14:30.',
      warning: 'Stock level below safety threshold.',
    }
    toast(messages[type], { description: 'ERP System Notification' })
    handleLog(`${type} toast triggered`)
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

  // Rule 9: Memoize columns to prevent unnecessary re-renders
  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.getValue('id')}</span>,
        enableHiding: false,
      },
      {
        accessorKey: 'supplier',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
        cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('supplier')}</span>,
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => <span className="text-foreground tabular-nums">{row.getValue('total')}</span>,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.getValue('status') as PurchaseOrder['status']
          return (
            <Badge
              variant={
                status === 'Approved' ? 'default' :
                status === 'Pending' ? 'secondary' :
                status === 'Received' ? 'success' :
                'destructive'
              }
            >
              {status}
            </Badge>
          )
        },
      },
    ],
    []
  )

  // Initialize the table instance to pass to both Toolbar and DataTable
  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // Enables global filter (search)
  })

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl space-y-10">
      {/* ── Header ── */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Component Playground
        </h1>
        <p className="text-muted-foreground">
          Isolated testing environment for all UI primitives and shared components.
        </p>
        <Separator />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Buttons                                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Buttons
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Variants */}
          <Card>
            <CardHeader>
              <CardTitle>Variants</CardTitle>
              <CardDescription>All button variants and states.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'success', 'warning', 'link'] as const).map((v) => (
                <Button key={v} variant={v} onClick={() => handleLog(`${v} button clicked`)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Sizes */}
          <Card>
            <CardHeader>
              <CardTitle>Sizes</CardTitle>
              <CardDescription>From xs to lg plus icon mode.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><Plus className="h-4 w-4" /></Button>
            </CardContent>
          </Card>

          {/* Loading State */}
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Async state with spinner.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button loading onClick={() => {}}>Loading...</Button>
              <Button variant="outline" loading={isLoading} onClick={triggerLoading}>
                {isLoading ? 'Saving...' : 'Trigger Load'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Inputs & Forms                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Inputs & Forms
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Text Input</CardTitle>
              <CardDescription>Standard and disabled states.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  placeholder="user@company.com"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disabled">Disabled</Label>
                <Input id="disabled" placeholder="Cannot edit" disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invalid">Invalid</Label>
                <Input id="invalid" placeholder="Required field" aria-invalid />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Textarea</CardTitle>
              <CardDescription>Multi-line text entry.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Order Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Enter special instructions..."
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select</CardTitle>
              <CardDescription>Dropdown selection with groups.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label>Status Filter</Label>
                <Select value={selectValue} onValueChange={setSelectValue}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Procurement</SelectLabel>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending Approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Fulfillment</SelectLabel>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Feedback & Status                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Feedback & Status
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Status indicators and labels.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="ghost">Ghost</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="link">Link</Badge>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>Contextual messaging.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>System Update</AlertTitle>
                <AlertDescription>
                  Scheduled maintenance tonight at 02:00 UTC.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Failed</AlertTitle>
                <AlertDescription>
                  3 line items exceed budget threshold.
                </AlertDescription>
                <AlertAction>
                  <Button size="sm" variant="outline">Review</Button>
                </AlertAction>
              </Alert>
            </CardContent>
          </Card>

          {/* Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle>Skeleton</CardTitle>
              <CardDescription>Loading placeholders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>

          {/* Sonner Toasts */}
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle>Sonner Toasts</CardTitle>
              <CardDescription>Notification system tied to your theme tokens.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => triggerToast('success')}>
                <CheckCircle2 className="h-4 w-4 text-success" />
                Success
              </Button>
              <Button variant="outline" onClick={() => triggerToast('error')}>
                <XCircle className="h-4 w-4 text-destructive" />
                Error
              </Button>
              <Button variant="outline" onClick={() => triggerToast('info')}>
                <Info className="h-4 w-4 text-info" />
                Info
              </Button>
              <Button variant="outline" onClick={() => triggerToast('warning')}>
                <AlertTriangle className="h-4 w-4 text-warning" />
                Warning
              </Button>

              <Separator orientation="vertical" className="h-9" />

              <Button
                variant="outline"
                onClick={() => {
                  handleLog('Promise toast started')
                  toast.promise(
                    new Promise<void>((resolve) =>
                      setTimeout(() => {
                        resolve()
                        handleLog('Promise toast resolved')
                      }, 2500)
                    ),
                    {
                      loading: 'Saving purchase order...',
                      success: 'Purchase order saved successfully.',
                      error: 'Failed to save purchase order.',
                    }
                  )
                }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Promise Toast
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Data Display                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Data Display
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Table */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>Recent procurement activity.</CardDescription>
              </div>
              <CardAction>
                <Button size="sm"><Plus className="h-4 w-4" /> New PO</Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rule 10: High-level wrapper composing the table instance */}
              <DataTableToolbar 
                table={table} 
                searchKey="id" 
                searchPlaceholder="Search POs..." 
              />
              <DataTable table={table} />
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
              <CardDescription>Default and line variants.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Dashboard overview content goes here.</p>
                  <div className="flex gap-2">
                    <Badge>Active</Badge>
                    <Badge variant="secondary">12 Alerts</Badge>
                  </div>
                </TabsContent>
                <TabsContent value="inventory" className="mt-4">
                  <p className="text-sm text-muted-foreground">Stock levels and warehouse data.</p>
                </TabsContent>
                <TabsContent value="orders" className="mt-4">
                  <p className="text-sm text-muted-foreground">Purchase and sales order pipeline.</p>
                </TabsContent>
              </Tabs>

              <Separator className="my-6" />

              <Tabs defaultValue="line1" variant="line">
                <TabsList>
                  <TabsTrigger value="line1">Details</TabsTrigger>
                  <TabsTrigger value="line2">History</TabsTrigger>
                  <TabsTrigger value="line3">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="line1" className="mt-4">
                  <p className="text-sm text-muted-foreground">Line variant tab content.</p>
                </TabsContent>
                <TabsContent value="line2" className="mt-4">
                  <p className="text-sm text-muted-foreground">Audit trail entries.</p>
                </TabsContent>
                <TabsContent value="line3" className="mt-4">
                  <p className="text-sm text-muted-foreground">Internal team notes.</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* ScrollArea */}
          <Card>
            <CardHeader>
              <CardTitle>ScrollArea</CardTitle>
              <CardDescription>Custom scroll with fade overlays.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ScrollArea className="h-64 w-56 rounded-lg border" scrollFade>
                <div className="p-4 space-y-2">
                  <h4 className="font-medium text-sm">Build Versions</h4>
                  {scrollTags.map((tag) => (
                    <div key={tag} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{tag}</span>
                      <Badge variant="outline" className="text-[10px]">tag</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Overlays                                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Overlays
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Dialog */}
          <Card>
            <CardHeader>
              <CardTitle>Dialog</CardTitle>
              <CardDescription>Modal overlay with header, content, and footer.</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Action</DialogTitle>
                    <DialogDescription>
                      This will permanently update the BOM structure. Are you sure?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground">
                      Review the impact on downstream work orders before proceeding.
                    </p>
                  </div>
                  <DialogFooter showCloseButton>
                    <Button variant="destructive" onClick={() => { handleLog('Dialog confirmed'); setDialogOpen(false) }}>
                      Confirm Change
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Stacked Dialog */}
          <Card>
            <CardHeader>
              <CardTitle>Stacked Dialog</CardTitle>
              <CardDescription>Nested dialog with backdrop blur and scale.</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Open Parent</Button>
                </DialogTrigger>
                <StackedDialogContent isNestedOpen={nestedOpen}>
                  <DialogHeader>
                    <DialogTitle>Parent Dialog</DialogTitle>
                    <DialogDescription>Click below to open a nested dialog.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Dialog open={nestedOpen} onOpenChange={setNestedOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">Open Nested</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Nested Dialog</DialogTitle>
                          <DialogDescription>This sits on top with the parent blurred behind.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter showCloseButton>
                          <Button onClick={() => setNestedOpen(false)}>Done</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </StackedDialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Sheet */}
          <Card>
            <CardHeader>
              <CardTitle>Sheet</CardTitle>
              <CardDescription>Slide-in panel from any edge.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
                <Sheet
                  key={side}
                  open={activeSheetSide === side}
                  onOpenChange={(open) => setActiveSheetSide(open ? side : null)}
                >
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      {side.charAt(0).toUpperCase() + side.slice(1)}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side={side}>
                    <SheetHeader>
                      <SheetTitle>Sheet Panel</SheetTitle>
                      <SheetDescription>Side: {side}</SheetDescription>
                    </SheetHeader>
                                        <div className="flex-1 px-4 py-6 space-y-4">
                      <div className="space-y-1.5">
                        <Label>Quick Action</Label>
                        <Input placeholder="Type something..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Textarea placeholder="Additional context..." />
                      </div>
                    </div>
                    <SheetFooter>
                      <Button onClick={() => { handleLog(`Sheet ${side} action`); setActiveSheetSide(null) }}>
                        Save
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              ))}
            </CardContent>
          </Card>

          {/* Tooltip */}
          <Card>
            <CardHeader>
              <CardTitle>Tooltip</CardTitle>
              <CardDescription>Hover-triggered contextual hints.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent>System Settings</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon"><Bell className="h-4 w-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Notifications</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon"><User className="h-4 w-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent>User Profile</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="cursor-help">Hover Me</Badge>
                  </TooltipTrigger>
                  <TooltipContent>Status: Active</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Collapsible */}
          <Card>
            <CardHeader>
              <CardTitle>Collapsible</CardTitle>
              <CardDescription>Expandable content sections.</CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <PanelLeft className="h-4 w-4" />
                      BOM Components
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", collapsibleOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 px-2">
                    <div className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Steel Frame A-102</span>
                        <Badge variant="outline">Qty: 4</Badge>
                      </div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Bearing Unit X-9</span>
                        <Badge variant="outline">Qty: 2</Badge>
                      </div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Hydraulic Pump HP-400</span>
                        <Badge variant="outline">Qty: 1</Badge>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Identity & Avatars                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Identity & Avatars
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Avatar</CardTitle>
              <CardDescription>User identity with fallback and badges.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <Avatar size="sm">
                  <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground uppercase">Small</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                  <AvatarFallback>CN</AvatarFallback>
                  <AvatarBadge />
                </Avatar>
                <span className="text-[10px] text-muted-foreground uppercase">Default + Badge</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar size="lg">
                  <AvatarFallback>JD</AvatarFallback>
                  <AvatarBadge />
                </Avatar>
                <span className="text-[10px] text-muted-foreground uppercase">Large Fallback</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avatar Group</CardTitle>
              <CardDescription>Stacked user indicators.</CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarGroup>
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>SC</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>MK</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>AL</AvatarFallback>
                </Avatar>
                <AvatarGroupCount>+3</AvatarGroupCount>
              </AvatarGroup>
            </CardContent>
          </Card>
        </div>
      </section>

       {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Shared Components                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-xl font-heading font-medium tracking-wide text-foreground">
          Shared Components
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
                    {/* HoldConfirm Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>HoldConfirmButton</CardTitle>
              <CardDescription>Press-and-hold confirmation to prevent accidental actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <HoldConfirmButton
                  onConfirm={() => handleLog('Traditional hold confirmed')}
                  duration={1500}
                  icon={<AlertTriangle className="h-4 w-4" />}
                >
                  Hold to Confirm
                </HoldConfirmButton>

                <HoldConfirmButton
                  onConfirm={() => handleLog('Danger hold confirmed')}
                  duration={2000}
                  variant="destructive"
                  icon={<Trash2 className="h-4 w-4" />}
                >
                  Hold to Delete (2s)
                </HoldConfirmButton>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Icon Ring Variants</p>
                <div className="flex items-center justify-center gap-4">
                  {(['default', 'secondary', 'outline', 'ghost', 'destructive'] as const).map((v) => (
                    <div key={v} className="flex flex-col items-center gap-2">
                      <HoldConfirmIconButton
                        variant={v}
                        onConfirm={() => handleLog(`${v} icon hold confirmed`)}
                        duration={1500}
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label={`Hold to confirm ${v} action`}
                      />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-6">
                  {[32, 40, 48].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-2">
                      <HoldConfirmIconButton
                        variant="outline"
                        onConfirm={() => handleLog(`${s}px icon hold confirmed`)}
                        duration={1500}
                        icon={<Trash2 className={s === 32 ? 'h-3 w-3' : s === 48 ? 'h-5 w-5' : 'h-4 w-4'} />}
                        size={s}
                        aria-label={`Hold to confirm ${s} pixel action`}
                      />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {s}px
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
              <CardDescription>Range and single-date selection with presets.</CardDescription>
            </CardHeader>
                       <CardContent className="space-y-6">
              {/* Range */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Range Selection</Label>
                <DatePicker
                  className="[--cell-size:--spacing(8)]"
                  selectionMode="range"
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Select date range"
                />
              </div>

              <Separator />

              {/* Single */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Single Selection</Label>
                <DatePicker
                  className="[--cell-size:--spacing(7)]"
                  selectionMode="single"
                  value={singleDate}
                  onChange={setSingleDate}
                  placeholder="Pick a date"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION: Event Log                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card>
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
            <Button variant="outline" size="sm" onClick={clearLogs} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Interact with any component above to see actions logged here.
            </p>
          ) : (
            <ScrollArea className="h-64 rounded-md border">
              <ul className="space-y-1 p-3">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-muted"
                  >
                    <span className="font-medium text-foreground">{log.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{log.timestamp}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────