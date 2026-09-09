"use client"

// ---------------- BLOCK 1: Imports ----------------
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createPartAction, updatePartAction } from "../actions/part-actions"

// ---------------- BLOCK 2: Types ----------------
interface PartFormValues {
  description: string
  partCode: string
  partType: string
  defaultUom: string
}

interface PartFormProps {
  mode: "create" | "edit"
  partId?: string
  initialValues?: PartFormValues
}

const EMPTY_VALUES: PartFormValues = {
  partCode: "",
  description: "",
  partType: "",
  defaultUom: "Each",
}

// ---------------- BLOCK 3: Form ----------------
export function PartForm({ mode, partId, initialValues = EMPTY_VALUES }: PartFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [values, setValues] = React.useState(initialValues)
  const isEdit = mode === "edit"

  const updateField = React.useCallback(
    (field: keyof PartFormValues, value: string) => {
      setValues((current) => ({ ...current, [field]: value }))
    },
    []
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = isEdit && partId
        ? await updatePartAction({
            partId,
            description: values.description,
            partType: values.partType,
            defaultUom: values.defaultUom,
          })
        : await createPartAction({
            partCode: values.partCode,
            description: values.description,
            partType: values.partType,
            defaultUom: values.defaultUom,
          })

      if (!result.success || !result.partId) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      router.push(`/products/parts/${result.partId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Part master data" : "New Part"}</CardTitle>
          <CardDescription>
            {isEdit
              ? "Update the descriptive fields used when this Part appears in BOMs."
              : "Create a reusable component that can be selected when building draft BOMs."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="part-code">Part code</Label>
              <Input
                id="part-code"
                value={values.partCode}
                onChange={(event) => updateField("partCode", event.target.value)}
                placeholder="e.g. CARTON-001"
                maxLength={64}
                required
                disabled={isEdit || isPending}
                autoFocus={!isEdit}
              />
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? "Part codes are permanent identifiers and cannot be changed after creation."
                  : "Codes are checked without regard to letter case or repeated spaces."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-type">Part type</Label>
              <Input
                id="part-type"
                value={values.partType}
                onChange={(event) => updateField("partType", event.target.value)}
                placeholder="e.g. Carton, Label, Raw Material"
                maxLength={64}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-uom">Default UOM</Label>
              <Input
                id="default-uom"
                value={values.defaultUom}
                onChange={(event) => updateField("defaultUom", event.target.value)}
                placeholder="e.g. Each, kg, metre"
                maxLength={32}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={values.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Describe the component so it can be identified reliably."
                maxLength={500}
                rows={4}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" asChild>
              <Link href={partId ? `/products/parts/${partId}` : "/products/parts"}>Cancel</Link>
            </Button>
            <Button type="submit" loading={isPending}>
              {isEdit ? "Save Changes" : "Create Part"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
