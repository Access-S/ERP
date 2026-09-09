// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PartForm } from "@/features/parts/components/part-form"
import { getPartById } from "@/features/parts/services/part-service"

// ---------------- BLOCK 2: Page ----------------
export default async function EditPartPage({
  params,
}: {
  params: Promise<{ partId: string }>
}) {
  const { partId } = await params
  const part = await getPartById(partId)
  if (!part) notFound()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/products/parts/${part.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {part.part_code}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Part</h1>
        <p className="text-sm text-muted-foreground">
          Update the master data for {part.part_code}.
        </p>
      </div>
      <div className="max-w-4xl">
        <PartForm
          mode="edit"
          partId={part.id}
          initialValues={{
            partCode: part.part_code,
            description: part.description ?? "",
            partType: part.part_type ?? "",
            defaultUom: part.default_uom ?? "",
          }}
        />
      </div>
    </div>
  )
}
