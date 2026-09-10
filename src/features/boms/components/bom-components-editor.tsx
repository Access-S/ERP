"use client"

// ───────────────── BLOCK 1: Imports ─────────────────
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addBomLineAction,
  removeBomLineAction,
  updateBomLineAction,
} from "../actions/bom-actions"
import type {
  BomLineItem,
  BomPartOption,
  BomStatus,
} from "../types/bom-schema"

// ───────────────── BLOCK 2: Types and Helpers ─────────────────
interface BomComponentsEditorProps {
  bomId: string
  status: BomStatus
  lines: BomLineItem[]
  partOptions: BomPartOption[]
  canEdit: boolean
  canViewParts: boolean
}

interface BomLineRowProps {
  editable: boolean
  canViewPart: boolean
  line: BomLineItem
  onEdit: (line: BomLineItem) => void
  onRemove: (line: BomLineItem) => void
}

interface PartOptionRowProps {
  disabled: boolean
  option: BomPartOption
  selected: boolean
  onSelect: (option: BomPartOption) => void
}

const quantityFormatter = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 8,
})

const PartOptionRow = React.memo(function PartOptionRow({
  disabled,
  option,
  selected,
  onSelect,
}: PartOptionRowProps) {
  return (
    <CommandItem
      value={`${option.part_code} ${option.description ?? ""} ${option.part_type ?? ""}`}
      disabled={disabled}
      data-checked={selected}
      onSelect={() => onSelect(option)}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{option.part_code}</p>
        <p className="truncate text-xs text-muted-foreground">
          {option.description ?? "No description"}
        </p>
      </div>
      {disabled && <Badge variant="outline">Already added</Badge>}
    </CommandItem>
  )
})

const BomLineRow = React.memo(function BomLineRow({
  editable,
  canViewPart,
  line,
  onEdit,
  onRemove,
}: BomLineRowProps) {
  return (
    <TableRow>
      <TableCell className="tabular-nums">{line.position ?? "—"}</TableCell>
      <TableCell>
        {canViewPart ? (
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={`/products/parts/${line.part_id}`}
          >
            {line.part_code}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{line.part_code}</span>
        )}
      </TableCell>
      <TableCell>
        <span className="block max-w-[320px] truncate" title={line.description ?? undefined}>
          {line.description ?? "—"}
        </span>
      </TableCell>
      <TableCell>{line.part_type ?? "—"}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {line.quantity === null ? "—" : quantityFormatter.format(line.quantity)}
      </TableCell>
      <TableCell>{line.uom ?? "—"}</TableCell>
      <TableCell>
        {line.issues.length === 0 ? (
          <Badge variant="secondary">Complete</Badge>
        ) : (
          <span className="text-sm text-destructive" title={line.issues.join(" · ")}>
            {line.issues.join(" · ")}
          </span>
        )}
      </TableCell>
      {editable && (
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              className="h-11 w-11 p-0"
              onClick={() => onEdit(line)}
              aria-label={`Edit ${line.part_code}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-11 p-0 text-destructive"
              onClick={() => onRemove(line)}
              aria-label={`Remove ${line.part_code}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  )
})

function validQuantity(value: string): boolean {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 && number <= 1_000_000
}

// ───────────────── BLOCK 3: Component ─────────────────
export function BomComponentsEditor({
  bomId,
  status,
  lines,
  partOptions,
  canEdit,
  canViewParts,
}: BomComponentsEditorProps) {
  const router = useRouter()
  const editable = status === "DRAFT" && canEdit
  const [isPending, startTransition] = React.useTransition()
  const [addOpen, setAddOpen] = React.useState(false)
  const [selectedPart, setSelectedPart] = React.useState<BomPartOption | null>(null)
  const [addQuantity, setAddQuantity] = React.useState("1")
  const [addUom, setAddUom] = React.useState("Each")
  const [editLine, setEditLine] = React.useState<BomLineItem | null>(null)
  const [editQuantity, setEditQuantity] = React.useState("")
  const [editUom, setEditUom] = React.useState("")
  const [removeLine, setRemoveLine] = React.useState<BomLineItem | null>(null)

  const existingPartIds = React.useMemo(
    () => new Set(lines.map((line) => line.part_id)),
    [lines]
  )

  const handlePartSelect = React.useCallback((option: BomPartOption) => {
    setSelectedPart(option)
    setAddUom(option.default_uom?.trim() || "Each")
  }, [])

  const handleEditOpen = React.useCallback((line: BomLineItem) => {
    setEditLine(line)
    setEditQuantity(line.quantity?.toString() ?? "")
    setEditUom(line.uom ?? "Each")
  }, [])

  const handleRemoveOpen = React.useCallback((line: BomLineItem) => {
    setRemoveLine(line)
  }, [])

  const handleAdd = React.useCallback(() => {
    if (!selectedPart) return
    startTransition(async () => {
      const result = await addBomLineAction({
        bomId,
        partId: selectedPart.id,
        quantity: Number(addQuantity),
        uom: addUom,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setAddOpen(false)
      setSelectedPart(null)
      setAddQuantity("1")
      setAddUom("Each")
      router.refresh()
    })
  }, [addQuantity, addUom, bomId, router, selectedPart])

  const handleUpdate = React.useCallback(() => {
    if (!editLine) return
    startTransition(async () => {
      const result = await updateBomLineAction({
        bomId,
        lineId: editLine.id,
        quantity: Number(editQuantity),
        uom: editUom,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setEditLine(null)
      router.refresh()
    })
  }, [bomId, editLine, editQuantity, editUom, router])

  const handleRemove = React.useCallback(() => {
    if (!removeLine) return
    startTransition(async () => {
      const result = await removeBomLineAction({ bomId, lineId: removeLine.id })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setRemoveLine(null)
      router.refresh()
    })
  }, [bomId, removeLine, router])

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Part
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add a Part</DialogTitle>
                <DialogDescription>
                  Search the active Parts Library, then enter the quantity required per shipper.
                </DialogDescription>
              </DialogHeader>
              <Command className="h-72 border">
                <CommandInput placeholder="Search Part code or description..." />
                <CommandList>
                  <CommandEmpty>No active Parts found.</CommandEmpty>
                  <CommandGroup>
                    {partOptions.map((option) => (
                      <PartOptionRow
                        key={option.id}
                        option={option}
                        disabled={existingPartIds.has(option.id)}
                        selected={selectedPart?.id === option.id}
                        onSelect={handlePartSelect}
                      />
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-bom-quantity">Quantity per Shipper</Label>
                  <Input
                    id="add-bom-quantity"
                    type="number"
                    min="0"
                    max="1000000"
                    step="any"
                    value={addQuantity}
                    onChange={(event) => setAddQuantity(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-bom-uom">Unit of Measure</Label>
                  <Input
                    id="add-bom-uom"
                    maxLength={32}
                    value={addUom}
                    onChange={(event) => setAddUom(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleAdd}
                  loading={isPending}
                  disabled={!selectedPart || !validQuantity(addQuantity) || !addUom.trim()}
                >
                  Add Part
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Part</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Per Shipper</TableHead>
            <TableHead>UOM</TableHead>
            <TableHead>Health</TableHead>
            {editable && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={editable ? 8 : 7} className="h-24 text-center text-muted-foreground">
                No components have been added to this BOM.
              </TableCell>
            </TableRow>
          ) : (
            lines.map((line) => (
              <BomLineRow
                key={line.id}
                editable={editable}
                canViewPart={canViewParts}
                line={line}
                onEdit={handleEditOpen}
                onRemove={handleRemoveOpen}
              />
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editLine)} onOpenChange={(open) => !open && setEditLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editLine?.part_code}</DialogTitle>
            <DialogDescription>
              Update the quantity and unit of measure for this draft BOM line.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bom-quantity">Quantity per Shipper</Label>
              <Input
                id="edit-bom-quantity"
                type="number"
                min="0"
                max="1000000"
                step="any"
                value={editQuantity}
                onChange={(event) => setEditQuantity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bom-uom">Unit of Measure</Label>
              <Input
                id="edit-bom-uom"
                maxLength={32}
                value={editUom}
                onChange={(event) => setEditUom(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleUpdate}
              loading={isPending}
              disabled={!validQuantity(editQuantity) || !editUom.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeLine)} onOpenChange={(open) => !open && setRemoveLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeLine?.part_code}?</DialogTitle>
            <DialogDescription>
              This removes the line only from this draft revision. Active and archived revisions are unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleRemove} loading={isPending}>
              Remove Part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
