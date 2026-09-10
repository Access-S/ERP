"use client"

// ---------------- BLOCK 1: Imports ----------------
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createCustomerAction, updateCustomerAction } from "../actions/customer-actions"

// ---------------- BLOCK 2: Types and Defaults ----------------
export interface CustomerFormValues {
  customerCode: string
  legalName: string
  tradingName: string
  customerType: string
  industry: string
  paymentTerms: string
  creditLimit: string
  defaultCurrency: string
  defaultDiscountPercentage: string
  taxId: string
  isTaxExempt: boolean
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
  accountsPayablesEmail: string
  notes: string
}

interface CustomerFormProps {
  mode: "create" | "edit"
  customerId?: string
  initialValues?: CustomerFormValues
  canEditIdentity: boolean
  canEditContacts: boolean
  canEditFinancial: boolean
}

const EMPTY_VALUES: CustomerFormValues = {
  customerCode: "",
  legalName: "",
  tradingName: "",
  customerType: "STANDARD",
  industry: "",
  paymentTerms: "",
  creditLimit: "0",
  defaultCurrency: "AUD",
  defaultDiscountPercentage: "0",
  taxId: "",
  isTaxExempt: false,
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  accountsPayablesEmail: "",
  notes: "",
}

// ---------------- BLOCK 3: Form ----------------
export function CustomerForm({
  mode,
  customerId,
  initialValues = EMPTY_VALUES,
  canEditIdentity,
  canEditContacts,
  canEditFinancial,
}: CustomerFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [values, setValues] = React.useState(initialValues)
  const isEdit = mode === "edit"

  const updateField = React.useCallback(
    <Key extends keyof CustomerFormValues>(field: Key, value: CustomerFormValues[Key]) => {
      setValues((current) => ({ ...current, [field]: value }))
    },
    []
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const identity = {
      legalName: values.legalName,
      tradingName: values.tradingName,
      customerType: values.customerType,
      industry: values.industry,
      notes: values.notes,
    }
    const contacts = {
      primaryContactName: values.primaryContactName,
      primaryContactEmail: values.primaryContactEmail,
      primaryContactPhone: values.primaryContactPhone,
    }
    const financial = {
      paymentTerms: values.paymentTerms,
      creditLimit: values.creditLimit,
      defaultCurrency: values.defaultCurrency,
      defaultDiscountPercentage: values.defaultDiscountPercentage,
      taxId: values.taxId,
      isTaxExempt: values.isTaxExempt,
      accountsPayablesEmail: values.accountsPayablesEmail,
    }

    startTransition(async () => {
      const result = isEdit && customerId
        ? await updateCustomerAction({
            customerId,
            ...(canEditIdentity ? { identity } : {}),
            ...(canEditContacts ? { contacts } : {}),
            ...(canEditFinancial ? { financial } : {}),
          })
        : await createCustomerAction({
            customerCode: values.customerCode,
            ...identity,
            ...contacts,
            ...financial,
          })

      if (!result.success || !result.customerId) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.push(`/products/customers/${result.customerId}`)
      router.refresh()
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Customer identity</CardTitle>
          <CardDescription>Names, classification, and account identity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-code">Customer code</Label>
            <Input
              id="customer-code"
              value={values.customerCode}
              onChange={(event) => updateField("customerCode", event.target.value)}
              maxLength={64}
              required
              disabled={isEdit || isPending || !canEditIdentity}
              autoFocus={!isEdit}
            />
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Customer codes are permanent identifiers and cannot be changed after creation."
                : "Codes are unique regardless of letter case or repeated spaces."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-type">Customer type</Label>
            <Input
              id="customer-type"
              value={values.customerType}
              onChange={(event) => updateField("customerType", event.target.value)}
              maxLength={64}
              required
              disabled={isPending || !canEditIdentity}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal name</Label>
            <Input
              id="legal-name"
              value={values.legalName}
              onChange={(event) => updateField("legalName", event.target.value)}
              maxLength={200}
              required
              disabled={isPending || !canEditIdentity}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trading-name">Trading name</Label>
            <Input
              id="trading-name"
              value={values.tradingName}
              onChange={(event) => updateField("tradingName", event.target.value)}
              maxLength={200}
              disabled={isPending || !canEditIdentity}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={values.industry}
              onChange={(event) => updateField("industry", event.target.value)}
              maxLength={100}
              disabled={isPending || !canEditIdentity}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commercial settings</CardTitle>
          <CardDescription>Default credit, payment, currency, and tax settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="payment-terms">Payment terms</Label>
            <Input
              id="payment-terms"
              value={values.paymentTerms}
              onChange={(event) => updateField("paymentTerms", event.target.value)}
              maxLength={100}
              disabled={isPending || !canEditFinancial}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-limit">Credit limit</Label>
            <Input
              id="credit-limit"
              type="number"
              min={0}
              step="any"
              value={values.creditLimit}
              onChange={(event) => updateField("creditLimit", event.target.value)}
              disabled={isPending || !canEditFinancial}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={values.defaultCurrency}
              onChange={(event) => updateField("defaultCurrency", event.target.value.toUpperCase())}
              minLength={3}
              maxLength={3}
              required
              disabled={isPending || !canEditFinancial}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount">Default discount %</Label>
            <Input
              id="discount"
              type="number"
              min={0}
              max={100}
              step="any"
              value={values.defaultDiscountPercentage}
              onChange={(event) => updateField("defaultDiscountPercentage", event.target.value)}
              disabled={isPending || !canEditFinancial}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-id">Tax ID / ABN</Label>
            <Input
              id="tax-id"
              value={values.taxId}
              onChange={(event) => updateField("taxId", event.target.value)}
              maxLength={64}
              disabled={isPending || !canEditFinancial}
            />
          </div>
          <div className="flex items-center gap-3 pt-7">
            <Checkbox
              id="tax-exempt"
              checked={values.isTaxExempt}
              onCheckedChange={(checked) => updateField("isTaxExempt", checked === true)}
              disabled={isPending || !canEditFinancial}
            />
            <Label htmlFor="tax-exempt">Tax exempt</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
          <CardDescription>Primary operational and accounts-payable contacts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Primary contact name</Label>
            <Input
              id="contact-name"
              value={values.primaryContactName}
              onChange={(event) => updateField("primaryContactName", event.target.value)}
              maxLength={200}
              disabled={isPending || !canEditContacts}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Primary contact phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={values.primaryContactPhone}
              onChange={(event) => updateField("primaryContactPhone", event.target.value)}
              maxLength={64}
              disabled={isPending || !canEditContacts}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Primary contact email</Label>
            <Input
              id="contact-email"
              type="email"
              value={values.primaryContactEmail}
              onChange={(event) => updateField("primaryContactEmail", event.target.value)}
              maxLength={254}
              disabled={isPending || !canEditContacts}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accounts-email">Accounts payable email</Label>
            <Input
              id="accounts-email"
              type="email"
              value={values.accountsPayablesEmail}
              onChange={(event) => updateField("accountsPayablesEmail", event.target.value)}
              maxLength={254}
              disabled={isPending || !canEditFinancial}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              maxLength={2000}
              rows={4}
              disabled={isPending || !canEditIdentity}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={customerId ? `/products/customers/${customerId}` : "/products/customers"}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          loading={isPending}
          disabled={!canEditIdentity && !canEditContacts && !canEditFinancial}
        >
          {isEdit ? "Save Changes" : "Create Customer"}
        </Button>
      </div>
    </form>
  )
}
