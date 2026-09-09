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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createProductAction, updateProductAction } from "../actions/product-actions"
import type { ProductCustomerOption } from "../services/product-service"

// ---------------- BLOCK 2: Types and Defaults ----------------
export interface ProductFormValues {
  productCode: string
  description: string
  customerId: string
  unitsPerShipper: string
  uom: string
  category: string
  dailyRunRate: string
  hourlyRunRate: string
  minsPerShipper: string
  pricePerShipper: string
}

interface ProductFormProps {
  mode: "create" | "edit"
  customerOptions: ProductCustomerOption[]
  productId?: string
  initialValues?: ProductFormValues
}

const NO_CUSTOMER = "__none__"
const EMPTY_VALUES: ProductFormValues = {
  productCode: "",
  description: "",
  customerId: "",
  unitsPerShipper: "",
  uom: "Each",
  category: "",
  dailyRunRate: "",
  hourlyRunRate: "",
  minsPerShipper: "",
  pricePerShipper: "",
}

// ---------------- BLOCK 3: Reusable Fields ----------------
interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  min?: number
  step?: number | "any"
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  min = 0,
  step = "any",
}: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  )
}

// ---------------- BLOCK 4: Form ----------------
export function ProductForm({
  mode,
  customerOptions,
  productId,
  initialValues = EMPTY_VALUES,
}: ProductFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [values, setValues] = React.useState(initialValues)
  const isEdit = mode === "edit"

  const updateField = React.useCallback(
    (field: keyof ProductFormValues, value: string) => {
      setValues((current) => ({ ...current, [field]: value }))
    },
    []
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const masterFields = {
      description: values.description,
      customerId: values.customerId,
      unitsPerShipper: values.unitsPerShipper,
      uom: values.uom,
      category: values.category,
      dailyRunRate: values.dailyRunRate,
      hourlyRunRate: values.hourlyRunRate,
      minsPerShipper: values.minsPerShipper,
      pricePerShipper: values.pricePerShipper,
    }

    startTransition(async () => {
      const result = isEdit && productId
        ? await updateProductAction({ productId, ...masterFields })
        : await createProductAction({ productCode: values.productCode, ...masterFields })

      if (!result.success || !result.productId) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.push(
        mode === "create" && result.bomId
          ? `/products/boms/${result.bomId}`
          : `/products/catalog/${result.productId}`
      )
      router.refresh()
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Product identity</CardTitle>
          <CardDescription>
            Identification, Customer ownership, and packaging information.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-code">Product code</Label>
            <Input
              id="product-code"
              value={values.productCode}
              onChange={(event) => updateField("productCode", event.target.value)}
              placeholder="e.g. FG-10001"
              maxLength={64}
              required
              disabled={isEdit || isPending}
              autoFocus={!isEdit}
            />
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Product codes are permanent identifiers and cannot be changed after creation."
                : "A blank editable BOM revision will be created with the Product."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select
              value={values.customerId || NO_CUSTOMER}
              onValueChange={(value) => updateField("customerId", value === NO_CUSTOMER ? "" : value)}
              disabled={isPending}
            >
              <SelectTrigger id="customer" className="w-full">
                <SelectValue placeholder="Select a Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>No Customer assigned</SelectItem>
                {customerOptions.map((customer) => (
                  <SelectItem
                    key={customer.id}
                    value={customer.id}
                    disabled={!customer.isActive}
                  >
                    {customer.code} - {customer.name}{customer.isActive ? "" : " (Inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe the finished good or Customer SKU."
              maxLength={500}
              rows={3}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={values.category}
              onChange={(event) => updateField("category", event.target.value)}
              maxLength={64}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uom">Unit of measure</Label>
            <Input
              id="uom"
              value={values.uom}
              onChange={(event) => updateField("uom", event.target.value)}
              maxLength={32}
              required
              disabled={isPending}
            />
          </div>

          <NumberField
            id="units-per-shipper"
            label="Units per shipper"
            value={values.unitsPerShipper}
            onChange={(value) => updateField("unitsPerShipper", value)}
            disabled={isPending}
            min={1}
            step={1}
          />
          <NumberField
            id="price-per-shipper"
            label="Price per shipper"
            value={values.pricePerShipper}
            onChange={(value) => updateField("pricePerShipper", value)}
            disabled={isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production planning</CardTitle>
          <CardDescription>
            Optional planning values used by scheduling and costing workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <NumberField
            id="daily-run-rate"
            label="Daily run rate"
            value={values.dailyRunRate}
            onChange={(value) => updateField("dailyRunRate", value)}
            disabled={isPending}
          />
          <NumberField
            id="hourly-run-rate"
            label="Hourly run rate"
            value={values.hourlyRunRate}
            onChange={(value) => updateField("hourlyRunRate", value)}
            disabled={isPending}
          />
          <NumberField
            id="mins-per-shipper"
            label="Minutes per shipper"
            value={values.minsPerShipper}
            onChange={(value) => updateField("minsPerShipper", value)}
            disabled={isPending}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={productId ? `/products/catalog/${productId}` : "/products/catalog"}>Cancel</Link>
        </Button>
        <Button type="submit" loading={isPending}>
          {isEdit ? "Save Changes" : "Create Product"}
        </Button>
      </div>
    </form>
  )
}
