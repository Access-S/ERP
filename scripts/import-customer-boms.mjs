import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { Prisma, PrismaClient } from "@prisma/client"
import {
  cappedDatabaseUrl,
  normalizeKey,
  readSource,
  sameQuantity,
} from "./dry-run-customer-bom-import.mjs"

const CONFIRMATION = "IMPORT-CUSTOMER-BOMS"
const DEFAULT_UOM = "Each"

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-")
}

function toJson(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2
  )
}

async function sourceChecksum(workbookPath) {
  const contents = await fs.readFile(workbookPath)
  return crypto.createHash("sha256").update(contents).digest("hex")
}

function addCustomerLookup(map, key, customer) {
  if (!key) return
  const matches = map.get(key) ?? new Map()
  matches.set(customer.id, customer)
  map.set(key, matches)
}

function indexUnique(items, keySelector, label) {
  const index = new Map()
  for (const item of items) {
    const key = keySelector(item)
    if (index.has(key)) throw new Error(`${label} ${key} is not unique in the database`)
    index.set(key, item)
  }
  return index
}

function activeBomMatchesSource(bom, sourceProduct) {
  if (bom.lines.length !== sourceProduct.lines.size) return false

  const databaseLines = new Map()
  for (const line of bom.lines) {
    const partKey = normalizeKey(line.part.normalized_code || line.part.part_code)
    if (databaseLines.has(partKey)) return false
    databaseLines.set(partKey, line.quantity)
  }

  for (const [partKey, sourceLine] of sourceProduct.lines) {
    if (!databaseLines.has(partKey)) return false
    if (!sameQuantity(databaseLines.get(partKey), sourceLine.quantity)) return false
  }
  return true
}

async function databaseSnapshot(prisma) {
  const customers = await prisma.customer.findMany()
  const products = await prisma.products.findMany()
  const parts = await prisma.part.findMany()
  const boms = await prisma.bom.findMany()
  const bomLines = await prisma.bomLine.findMany()

  return { customers, products, parts, boms, bomLines }
}

async function writeBackup(prisma, workbookPath, checksum, runTimestamp) {
  const backupDirectory = path.join(process.cwd(), "Data files", "backups")
  await fs.mkdir(backupDirectory, { recursive: true })
  const backupPath = path.join(
    backupDirectory,
    `customer-bom-before-${runTimestamp}.json`
  )
  const snapshot = await databaseSnapshot(prisma)
  await fs.writeFile(
    backupPath,
    toJson({
      createdAt: new Date().toISOString(),
      sourceWorkbook: path.resolve(workbookPath),
      sourceSha256: checksum,
      ...snapshot,
    }),
    "utf8"
  )
  return { backupPath, snapshot }
}

async function applyImport(prisma, source) {
  const now = new Date()

  return prisma.$transaction(
    async (tx) => {
      const existingCustomers = await tx.customer.findMany({
        select: {
          id: true,
          customer_code: true,
          legal_name: true,
          trading_name: true,
        },
      })
      const customerByName = new Map()
      for (const customer of existingCustomers) {
        addCustomerLookup(customerByName, normalizeKey(customer.legal_name), customer)
        addCustomerLookup(customerByName, normalizeKey(customer.trading_name), customer)
      }

      const customerIdBySourceKey = new Map()
      for (const sourceCustomer of source.customers.values()) {
        const matches = [...(customerByName.get(sourceCustomer.key)?.values() ?? [])]
        if (matches.length !== 1) {
          throw new Error(
            `Customer ${sourceCustomer.name} matched ${matches.length} database records; expected exactly one`
          )
        }
        customerIdBySourceKey.set(sourceCustomer.key, matches[0].id)
      }

      const existingProducts = await tx.products.findMany({
        select: {
          id: true,
          product_code: true,
          description: true,
          customer_id: true,
          is_active: true,
        },
      })
      const productByKey = indexUnique(
        existingProducts,
        (product) => normalizeKey(product.product_code),
        "Product code"
      )

      const productsToCreate = []
      const productsToUpdate = []
      for (const sourceProduct of source.products.values()) {
        const customerId = customerIdBySourceKey.get(sourceProduct.customerKey)
        const existing = productByKey.get(sourceProduct.key)
        if (existing) {
          productsToUpdate.push({
            id: existing.id,
            productCode: sourceProduct.code,
            description: sourceProduct.description,
            customerId,
          })
        } else {
          productsToCreate.push({
            product_code: sourceProduct.code,
            description: sourceProduct.description,
            customer_id: customerId,
            uom: DEFAULT_UOM,
            is_active: true,
          })
        }
      }

      const sourceProductKeys = new Set(source.products.keys())
      const databaseOnlyProducts = existingProducts.filter(
        (product) => !sourceProductKeys.has(normalizeKey(product.product_code))
      )

      if (productsToCreate.length > 0) {
        await tx.products.createMany({ data: productsToCreate })
      }
      for (const product of productsToUpdate) {
        await tx.products.update({
          where: { id: product.id },
          data: {
            product_code: product.productCode,
            description: product.description,
            customer_id: product.customerId,
            uom: DEFAULT_UOM,
            is_active: true,
            updated_at: now,
          },
        })
      }
      if (databaseOnlyProducts.length > 0) {
        await tx.products.updateMany({
          where: { id: { in: databaseOnlyProducts.map((product) => product.id) } },
          data: { is_active: false, updated_at: now },
        })
      }

      const importedProducts = await tx.products.findMany({
        where: {
          product_code: { in: [...source.products.values()].map((product) => product.code) },
        },
        select: { id: true, product_code: true, customer_id: true },
      })
      if (importedProducts.length !== source.products.size) {
        throw new Error(
          `Expected ${source.products.size} imported products; found ${importedProducts.length}`
        )
      }
      const importedProductByKey = indexUnique(
        importedProducts,
        (product) => normalizeKey(product.product_code),
        "Imported product code"
      )

      const existingParts = await tx.part.findMany({
        select: {
          id: true,
          part_code: true,
          normalized_code: true,
          default_uom: true,
          is_active: true,
        },
      })
      const partByKey = indexUnique(
        existingParts,
        (part) => normalizeKey(part.normalized_code || part.part_code),
        "Part code"
      )
      const partsToCreate = [...source.parts.values()]
        .filter((part) => !partByKey.has(part.key))
        .map((part) => ({
          part_code: part.code,
          normalized_code: part.normalizedCode,
          description: part.description,
          part_type: part.partType,
          default_uom: DEFAULT_UOM,
          is_active: true,
        }))
      const partsToNormalize = existingParts
        .map((part) => ({
          existing: part,
          source: source.parts.get(
            normalizeKey(part.normalized_code || part.part_code)
          ),
        }))
        .filter(
          ({ existing, source: sourcePart }) =>
            sourcePart &&
            (existing.normalized_code !== sourcePart.normalizedCode ||
              existing.part_code !== sourcePart.code)
        )

      if (partsToCreate.length > 0) {
        await tx.part.createMany({ data: partsToCreate })
      }
      for (const { existing, source: sourcePart } of partsToNormalize) {
        await tx.part.update({
          where: { id: existing.id },
          data: {
            part_code: sourcePart.code,
            normalized_code: sourcePart.normalizedCode,
            updated_at: now,
          },
        })
      }

      const importedParts = await tx.part.findMany({
        where: {
          normalized_code: {
            in: [...source.parts.values()].map((part) => part.normalizedCode),
          },
        },
        select: { id: true, part_code: true, normalized_code: true },
      })
      if (importedParts.length !== source.parts.size) {
        throw new Error(
          `Expected ${source.parts.size} imported parts; found ${importedParts.length}`
        )
      }
      const importedPartByKey = indexUnique(
        importedParts,
        (part) => normalizeKey(part.normalized_code || part.part_code),
        "Imported part code"
      )

      await tx.part.updateMany({
        where: { id: { in: importedParts.map((part) => part.id) } },
        data: { default_uom: DEFAULT_UOM, is_active: true, updated_at: now },
      })

      const sourceProductIds = importedProducts.map((product) => product.id)
      const databaseOnlyProductIds = databaseOnlyProducts.map((product) => product.id)
      const relevantBoms = await tx.bom.findMany({
        where: {
          product_id: { in: [...sourceProductIds, ...databaseOnlyProductIds] },
        },
        select: {
          id: true,
          product_id: true,
          revision: true,
          status: true,
          lines: {
            select: {
              quantity: true,
              part: {
                select: { part_code: true, normalized_code: true },
              },
            },
          },
        },
      })

      const bomsByProductId = new Map()
      for (const bom of relevantBoms) {
        const boms = bomsByProductId.get(bom.product_id) ?? []
        boms.push(bom)
        bomsByProductId.set(bom.product_id, boms)
      }

      const bomIdsToArchive = new Set()
      for (const productId of databaseOnlyProductIds) {
        for (const bom of bomsByProductId.get(productId) ?? []) {
          if (bom.status === "ACTIVE") bomIdsToArchive.add(bom.id)
        }
      }

      const bomsToCreate = []
      const unchangedBomIds = []
      for (const sourceProduct of source.products.values()) {
        const databaseProduct = importedProductByKey.get(sourceProduct.key)
        const productBoms = bomsByProductId.get(databaseProduct.id) ?? []
        const activeBoms = productBoms.filter((bom) => bom.status === "ACTIVE")
        const exactActiveBom =
          activeBoms.length === 1 &&
          activeBomMatchesSource(activeBoms[0], sourceProduct)
            ? activeBoms[0]
            : null

        if (exactActiveBom) {
          unchangedBomIds.push(exactActiveBom.id)
          continue
        }

        for (const bom of activeBoms) bomIdsToArchive.add(bom.id)
        const maximumRevision = productBoms.reduce(
          (maximum, bom) => Math.max(maximum, bom.revision),
          0
        )
        bomsToCreate.push({
          productId: databaseProduct.id,
          productKey: sourceProduct.key,
          revision: maximumRevision + 1,
        })
      }

      if (bomIdsToArchive.size > 0) {
        await tx.bom.updateMany({
          where: { id: { in: [...bomIdsToArchive] } },
          data: { status: "ARCHIVED", effective_to: now, updated_at: now },
        })
      }

      if (bomsToCreate.length > 0) {
        await tx.bom.createMany({
          data: bomsToCreate.map((bom) => ({
            product_id: bom.productId,
            revision: bom.revision,
            status: "ACTIVE",
            quantity_basis: "PER_SHIPPER",
            effective_from: now,
          })),
        })
      }

      const createdBoms =
        bomsToCreate.length === 0
          ? []
          : await tx.bom.findMany({
              where: {
                OR: bomsToCreate.map((bom) => ({
                  product_id: bom.productId,
                  revision: bom.revision,
                })),
              },
              select: { id: true, product_id: true, revision: true },
            })
      if (createdBoms.length !== bomsToCreate.length) {
        throw new Error(
          `Expected ${bomsToCreate.length} newly selected BOMs; found ${createdBoms.length}`
        )
      }

      const createdBomByProductId = indexUnique(
        createdBoms,
        (bom) => bom.product_id,
        "Created BOM product"
      )
      const bomLinesToCreate = []
      for (const bomDefinition of bomsToCreate) {
        const bom = createdBomByProductId.get(bomDefinition.productId)
        const sourceProduct = source.products.get(bomDefinition.productKey)
        let position = 1
        for (const sourceLine of sourceProduct.lines.values()) {
          const part = importedPartByKey.get(sourceLine.partKey)
          if (!part) {
            throw new Error(
              `Part ${sourceLine.partKey} was not resolved for product ${sourceProduct.code}`
            )
          }
          bomLinesToCreate.push({
            bom_id: bom.id,
            part_id: part.id,
            quantity: new Prisma.Decimal(String(sourceLine.quantity)),
            uom: DEFAULT_UOM,
            position,
          })
          position += 1
        }
      }

      if (bomLinesToCreate.length > 0) {
        await tx.bomLine.createMany({ data: bomLinesToCreate })
      }

      const existingNullUoms = await tx.bomLine.count({
        where: { bom_id: { in: unchangedBomIds }, uom: null },
      })
      if (existingNullUoms > 0) {
        await tx.bomLine.updateMany({
          where: { bom_id: { in: unchangedBomIds }, uom: null },
          data: { uom: DEFAULT_UOM, updated_at: now },
        })
      }

      const activePartRows = await tx.bomLine.findMany({
        where: { bom: { status: "ACTIVE" } },
        distinct: ["part_id"],
        select: { part_id: true },
      })
      const activePartIds = new Set(activePartRows.map((row) => row.part_id))
      const sourcePartIds = new Set(importedParts.map((part) => part.id))
      const partsToDeactivate = (
        await tx.part.findMany({ select: { id: true } })
      ).filter(
        (part) => !sourcePartIds.has(part.id) && !activePartIds.has(part.id)
      )
      if (partsToDeactivate.length > 0) {
        await tx.part.updateMany({
          where: { id: { in: partsToDeactivate.map((part) => part.id) } },
          data: { is_active: false, updated_at: now },
        })
      }

      const verifiedProducts = await tx.products.findMany({
        where: { id: { in: sourceProductIds } },
        select: { id: true, product_code: true, customer_id: true, is_active: true },
      })
      if (verifiedProducts.length !== source.products.size) {
        throw new Error("Post-import product count does not match the workbook")
      }
      for (const product of verifiedProducts) {
        const sourceProduct = source.products.get(normalizeKey(product.product_code))
        const expectedCustomerId = customerIdBySourceKey.get(sourceProduct.customerKey)
        if (!product.is_active || product.customer_id !== expectedCustomerId) {
          throw new Error(`Post-import customer link failed for ${product.product_code}`)
        }
      }

      const verifiedActiveBoms = await tx.bom.findMany({
        where: { product_id: { in: sourceProductIds }, status: "ACTIVE" },
        select: {
          product_id: true,
          _count: { select: { lines: true } },
        },
      })
      if (verifiedActiveBoms.length !== source.products.size) {
        throw new Error(
          `Expected one active BOM for each of ${source.products.size} products; found ${verifiedActiveBoms.length}`
        )
      }
      const activeProductIds = new Set()
      let verifiedLineCount = 0
      for (const bom of verifiedActiveBoms) {
        if (activeProductIds.has(bom.product_id)) {
          throw new Error(`Multiple active BOMs found for product ${bom.product_id}`)
        }
        activeProductIds.add(bom.product_id)
        verifiedLineCount += bom._count.lines
      }
      if (verifiedLineCount !== source.rowCount) {
        throw new Error(
          `Expected ${source.rowCount} active BOM lines; found ${verifiedLineCount}`
        )
      }

      return {
        customersMatched: source.customers.size,
        productsCreated: productsToCreate.length,
        productsUpdated: productsToUpdate.length,
        productsDeactivated: databaseOnlyProducts.length,
        partsCreated: partsToCreate.length,
        partCodesNormalized: partsToNormalize.length,
        partsActivated: importedParts.length,
        partsDeactivated: partsToDeactivate.length,
        bomsArchived: bomIdsToArchive.size,
        bomsCreated: bomsToCreate.length,
        bomsUnchanged: unchangedBomIds.length,
        bomLinesCreated: bomLinesToCreate.length,
        existingBomLineUomsFilled: existingNullUoms,
        verifiedActiveProducts: verifiedProducts.length,
        verifiedActiveBoms: verifiedActiveBoms.length,
        verifiedActiveBomLines: verifiedLineCount,
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 120_000,
    }
  )
}

async function main() {
  const workbookPath = process.argv[2]
  const confirmation = process.argv.find((argument) => argument.startsWith("--confirm="))
  if (!workbookPath || confirmation !== `--confirm=${CONFIRMATION}`) {
    throw new Error(
      `Usage: node --env-file=.env scripts/import-customer-boms.mjs <workbook.xlsx> --confirm=${CONFIRMATION}`
    )
  }

  const source = await readSource(workbookPath)
  if (source.validationErrors.length > 0) {
    console.table(source.validationErrors.slice(0, 20))
    throw new Error(`Workbook has ${source.validationErrors.length} validation errors`)
  }

  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) throw new Error("DATABASE_URL is not configured")
  const prisma = new PrismaClient({
    datasources: { db: { url: cappedDatabaseUrl(rawUrl) } },
  })

  const runTimestamp = timestampForFile()
  const checksum = await sourceChecksum(workbookPath)

  try {
    console.log("Creating pre-import snapshot...")
    const { backupPath, snapshot } = await writeBackup(
      prisma,
      workbookPath,
      checksum,
      runTimestamp
    )
    console.log(`Backup: ${backupPath}`)
    console.table({
      customers: snapshot.customers.length,
      products: snapshot.products.length,
      parts: snapshot.parts.length,
      boms: snapshot.boms.length,
      bomLines: snapshot.bomLines.length,
    })

    console.log("Applying transactional import...")
    const result = await applyImport(prisma, source)
    console.log("Import committed and verified.")
    console.table(result)

    const reportPath = path.join(
      process.cwd(),
      "Data files",
      "backups",
      `customer-bom-import-${runTimestamp}.json`
    )
    await fs.writeFile(
      reportPath,
      toJson({
        completedAt: new Date().toISOString(),
        sourceWorkbook: path.resolve(workbookPath),
        sourceSha256: checksum,
        backupPath,
        result,
      }),
      "utf8"
    )
    console.log(`Report: ${reportPath}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("\nImport failed:", error)
  console.error("No partial transaction changes were committed.")
  process.exitCode = 1
})
