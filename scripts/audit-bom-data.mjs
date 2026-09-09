// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import { PrismaClient } from "@prisma/client"

// ───────────────── BLOCK 2: Helpers ──────────────────────────────────────────
const prisma = new PrismaClient()

function normalizePartCode(value) {
  return value.trim().toUpperCase()
}

function nonBlank(value) {
  return value == null || value.trim() === "" ? null : value.trim()
}

function addValue(map, key, value) {
  if (!value) return
  const values = map.get(key) ?? new Set()
  values.add(value)
  map.set(key, values)
}

// ───────────────── BLOCK 3: Audit ────────────────────────────────────────────
async function main() {
  const [
    productCount,
    activeProductCount,
    productsWithoutComponents,
    componentCount,
    linkedComponentCount,
    unlinkedComponentCount,
    missingQuantityCount,
    nonPositiveQuantityCount,
    componentRows,
    normalizedPartCount,
    normalizedBomCount,
    normalizedBomLineCount,
  ] = await Promise.all([
    prisma.products.count(),
    prisma.products.count({ where: { is_active: true } }),
    prisma.products.count({ where: { bom_components: { none: {} } } }),
    prisma.bom_components.count(),
    prisma.bom_components.count({ where: { product_id: { not: null } } }),
    prisma.bom_components.count({ where: { product_id: null } }),
    prisma.bom_components.count({ where: { per_shipper: null } }),
    prisma.bom_components.count({ where: { per_shipper: { lte: 0 } } }),
    prisma.bom_components.findMany({
      select: {
        id: true,
        product_id: true,
        part_code: true,
        part_description: true,
        part_type: true,
        per_shipper: true,
        products: { select: { product_code: true } },
      },
    }),
    prisma.part.count(),
    prisma.bom.count(),
    prisma.bomLine.count(),
  ])

  const [rowLevelSecurity, policies, extensions] = await Promise.all([
    prisma.$queryRaw`
      SELECT c.relname AS table_name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
      ORDER BY c.relname
    `,
    prisma.$queryRaw`
      SELECT
        tablename AS table_name,
        policyname AS policy_name,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `,
    prisma.$queryRaw`
      SELECT extname AS extension_name
      FROM pg_extension
      ORDER BY extname
    `,
  ])

  const codeVariants = new Map()
  const descriptionsByCode = new Map()
  const typesByCode = new Map()
  const productPartCounts = new Map()
  const linkedProductIds = new Set()
  let blankPartCodeCount = 0
  let missingDescriptionCount = 0
  let missingTypeCount = 0

  for (const row of componentRows) {
    const normalizedCode = normalizePartCode(row.part_code)
    if (!normalizedCode) blankPartCodeCount += 1

    addValue(codeVariants, normalizedCode, row.part_code)
    addValue(descriptionsByCode, normalizedCode, nonBlank(row.part_description))
    addValue(typesByCode, normalizedCode, nonBlank(row.part_type))

    if (!nonBlank(row.part_description)) missingDescriptionCount += 1
    if (!nonBlank(row.part_type)) missingTypeCount += 1

    if (row.product_id) {
      linkedProductIds.add(row.product_id)
      const pairKey = `${row.products?.product_code ?? row.product_id}:${normalizedCode}`
      productPartCounts.set(pairKey, (productPartCounts.get(pairKey) ?? 0) + 1)
    }
  }

  const duplicatePartCodes = [...codeVariants.entries()].filter(
    ([, values]) => values.size > 1
  )
  const conflictingDescriptions = [...descriptionsByCode.entries()].filter(
    ([, values]) => values.size > 1
  )
  const conflictingTypes = [...typesByCode.entries()].filter(
    ([, values]) => values.size > 1
  )
  const duplicateProductPartPairs = [...productPartCounts.entries()].filter(
    ([, count]) => count > 1
  )

  console.log("\nBOM DATA AUDIT")
  console.log("==============")
  console.table({
    products: productCount,
    activeProducts: activeProductCount,
    productsWithComponentRows: linkedProductIds.size,
    productsWithoutComponentRows: productsWithoutComponents,
    componentRows: componentCount,
    linkedComponentRows: linkedComponentCount,
    unlinkedComponentRows: unlinkedComponentCount,
    uniqueNormalizedPartCodes: codeVariants.size,
    blankPartCodes: blankPartCodeCount,
    missingQuantities: missingQuantityCount,
    nonPositiveQuantities: nonPositiveQuantityCount,
    missingDescriptions: missingDescriptionCount,
    missingPartTypes: missingTypeCount,
    caseOrWhitespaceCodeVariants: duplicatePartCodes.length,
    conflictingDescriptions: conflictingDescriptions.length,
    conflictingPartTypes: conflictingTypes.length,
    duplicatePartWithinProductGroups: duplicateProductPartPairs.length,
    normalizedParts: normalizedPartCount,
    normalizedBoms: normalizedBomCount,
    normalizedBomLines: normalizedBomLineCount,
    normalizedBackfillMatches:
      normalizedPartCount === codeVariants.size &&
      normalizedBomCount === linkedProductIds.size &&
      normalizedBomLineCount === linkedComponentCount,
  })

  const anomalyGroups = [
    ["Case/whitespace variants", duplicatePartCodes],
    ["Conflicting descriptions", conflictingDescriptions],
    ["Conflicting part types", conflictingTypes],
  ]

  for (const [label, entries] of anomalyGroups) {
    if (entries.length === 0) continue
    console.log(`\n${label} (first 20)`)
    console.table(
      entries.slice(0, 20).map(([partCode, values]) => ({
        partCode,
        values: [...values].join(" | "),
      }))
    )
  }

  if (duplicateProductPartPairs.length > 0) {
    console.log("\nDuplicate Part within Product groups (first 20)")
    console.table(
      duplicateProductPartPairs.slice(0, 20).map(([pair, count]) => {
        const [productCode, partCode] = pair.split(":")
        return { productCode, partCode, rows: count }
      })
    )
  }

  const invalidQuantityRows = componentRows.filter(
    (row) => row.per_shipper != null && Number(row.per_shipper) <= 0
  )
  if (invalidQuantityRows.length > 0) {
    console.log("\nNon-positive quantities (first 20)")
    console.table(
      invalidQuantityRows.slice(0, 20).map((row) => ({
        productCode: row.products?.product_code ?? "Unlinked",
        partCode: row.part_code,
        perShipper: Number(row.per_shipper),
      }))
    )
  }


  console.log("\nDatabase features relevant to migration baselining")
  console.table({
    rowLevelSecurityTables: rowLevelSecurity.length,
    rowLevelSecurityPolicies: policies.length,
    installedExtensions: extensions.map((row) => row.extension_name).join(", "),
  })

  if (rowLevelSecurity.length > 0) console.table(rowLevelSecurity)
  if (policies.length > 0) console.table(policies)
}

// ───────────────── BLOCK 4: Execution ────────────────────────────────────────
main()
  .catch((error) => {
    console.error("BOM audit failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
