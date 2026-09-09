import process from "node:process"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ExcelJS from "exceljs"
import { PrismaClient } from "@prisma/client"

const EXPECTED_HEADERS = [
  "Customer",
  "Product Code",
  "Product Description",
  "Part code",
  "Part type",
  "Part Description",
  "units per shipper",
]

const BOUNDARIES = {
  customer: 80,
  productCode: 64,
  productDescription: 255,
  partCode: 64,
  partType: 64,
  partDescription: 500,
  quantityMax: 1_000_000,
  quantityDecimalPlaces: 8,
}

function scalarValue(value) {
  if (value == null) return null
  if (value instanceof Date) return value
  if (typeof value !== "object") return value
  if ("result" in value) return scalarValue(value.result)
  if ("richText" in value) {
    return value.richText.map((item) => item.text ?? "").join("")
  }
  if ("text" in value) return value.text
  return String(value)
}

function cleanText(value) {
  const scalar = scalarValue(value)
  if (scalar == null) return ""
  return String(scalar).replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ")
}

function normalizeKey(value) {
  return cleanText(value).toUpperCase()
}

function decimalPlaces(value) {
  const text = String(value).toLowerCase()
  if (text.includes("e-")) {
    const [coefficient, exponentText] = text.split("e-")
    const coefficientPlaces = coefficient.split(".")[1]?.length ?? 0
    return Number(exponentText) + coefficientPlaces
  }
  return text.split(".")[1]?.length ?? 0
}

function increment(map, key, value) {
  const values = map.get(key) ?? new Map()
  values.set(value, (values.get(value) ?? 0) + 1)
  map.set(key, values)
}

function chooseCanonical(values) {
  return [...values.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount ||
      rightValue.length - leftValue.length ||
      leftValue.localeCompare(rightValue)
  )[0]?.[0] ?? ""
}

function customerCode(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " AND ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

function cappedDatabaseUrl(rawUrl) {
  const url = new URL(rawUrl)
  url.searchParams.set("connection_limit", "1")
  url.searchParams.set("pool_timeout", "5")
  return url.toString()
}

function addLookup(map, key, value) {
  if (!key) return
  const values = map.get(key) ?? []
  values.push(value)
  map.set(key, values)
}

function sameText(left, right) {
  return normalizeKey(left) === normalizeKey(right)
}

function sameQuantity(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.000000001
}

function printExamples(title, rows) {
  if (rows.length === 0) return
  console.log(`\n${title} (first ${Math.min(rows.length, 20)})`)
  console.table(rows.slice(0, 20))
}

async function readSource(workbookPath) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(workbookPath)

  if (workbook.worksheets.length !== 1) {
    throw new Error(`Expected one worksheet; found ${workbook.worksheets.length}`)
  }

  const sheet = workbook.worksheets[0]
  const headers = sheet.getRow(1).values.slice(1, 8).map(cleanText)
  if (headers.join("|") !== EXPECTED_HEADERS.join("|")) {
    throw new Error(
      `Header mismatch. Expected ${EXPECTED_HEADERS.join(" | ")}; received ${headers.join(" | ")}`
    )
  }

  const customers = new Map()
  const products = new Map()
  const partCodes = new Map()
  const partDescriptions = new Map()
  const partTypes = new Map()
  const validationErrors = []
  const duplicateLines = []
  const sourceTypeCounts = { numericProductCodes: 0, textProductCodes: 0 }
  let rowCount = 0

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const cells = EXPECTED_HEADERS.map((_, index) =>
      scalarValue(sheet.getRow(rowNumber).getCell(index + 1).value)
    )
    if (cells.every((value) => cleanText(value) === "")) continue
    rowCount += 1

    const customerName = cleanText(cells[0])
    const productCode = cleanText(cells[1])
    const productDescription = cleanText(cells[2])
    const partCode = cleanText(cells[3])
    const partType = cleanText(cells[4])
    const partDescription = cleanText(cells[5])
    const quantity = Number(scalarValue(cells[6]))

    if (typeof scalarValue(cells[1]) === "number") {
      sourceTypeCounts.numericProductCodes += 1
    } else {
      sourceTypeCounts.textProductCodes += 1
    }

    const required = [
      ["Customer", customerName],
      ["Product Code", productCode],
      ["Product Description", productDescription],
      ["Part code", partCode],
      ["Part type", partType],
      ["Part Description", partDescription],
    ]
    for (const [field, value] of required) {
      if (!value) validationErrors.push({ row: rowNumber, field, issue: "Required value is blank" })
    }

    const lengthChecks = [
      ["Customer", customerName, BOUNDARIES.customer],
      ["Product Code", productCode, BOUNDARIES.productCode],
      ["Product Description", productDescription, BOUNDARIES.productDescription],
      ["Part code", partCode, BOUNDARIES.partCode],
      ["Part type", partType, BOUNDARIES.partType],
      ["Part Description", partDescription, BOUNDARIES.partDescription],
    ]
    for (const [field, value, maximum] of lengthChecks) {
      if (value.length > maximum) {
        validationErrors.push({
          row: rowNumber,
          field,
          issue: `Length ${value.length} exceeds ${maximum}`,
        })
      }
    }

    if (!Number.isFinite(quantity)) {
      validationErrors.push({ row: rowNumber, field: "units per shipper", issue: "Not numeric" })
    } else if (quantity <= 0 || quantity > BOUNDARIES.quantityMax) {
      validationErrors.push({
        row: rowNumber,
        field: "units per shipper",
        issue: `Must be greater than 0 and no more than ${BOUNDARIES.quantityMax}`,
      })
    } else if (decimalPlaces(quantity) > BOUNDARIES.quantityDecimalPlaces) {
      validationErrors.push({
        row: rowNumber,
        field: "units per shipper",
        issue: `More than ${BOUNDARIES.quantityDecimalPlaces} decimal places`,
      })
    }

    const customerKey = normalizeKey(customerName)
    const productKey = normalizeKey(productCode)
    const partKey = normalizeKey(partCode)

    const existingCustomer = customers.get(customerKey)
    if (existingCustomer && existingCustomer.name !== customerName) {
      validationErrors.push({
        row: rowNumber,
        field: "Customer",
        issue: `Normalized duplicate of ${existingCustomer.name}`,
      })
    } else if (!existingCustomer) {
      customers.set(customerKey, {
        key: customerKey,
        name: customerName,
        proposedCode: customerCode(customerName),
      })
    }

    const existingProduct = products.get(productKey)
    if (existingProduct) {
      if (existingProduct.customerKey !== customerKey) {
        validationErrors.push({
          row: rowNumber,
          field: "Product Code",
          issue: `Product is assigned to both ${existingProduct.customerName} and ${customerName}`,
        })
      }
      if (!sameText(existingProduct.description, productDescription)) {
        validationErrors.push({
          row: rowNumber,
          field: "Product Description",
          issue: `Product ${productCode} has conflicting descriptions`,
        })
      }
    } else {
      products.set(productKey, {
        key: productKey,
        code: productCode,
        description: productDescription,
        customerKey,
        customerName,
        lines: new Map(),
      })
    }

    const product = products.get(productKey)
    if (product.lines.has(partKey)) {
      duplicateLines.push({
        row: rowNumber,
        productCode,
        partCode,
        firstRow: product.lines.get(partKey).row,
      })
    } else {
      product.lines.set(partKey, { row: rowNumber, partKey, quantity })
    }

    increment(partCodes, partKey, partCode)
    increment(partDescriptions, partKey, partDescription)
    increment(partTypes, partKey, partType)
  }

  if (duplicateLines.length > 0) {
    validationErrors.push(
      ...duplicateLines.map((line) => ({
        row: line.row,
        field: "Part code",
        issue: `Duplicate BOM line; first appears on row ${line.firstRow}`,
      }))
    )
  }

  const parts = new Map()
  for (const [partKey, codeValues] of partCodes) {
    parts.set(partKey, {
      key: partKey,
      code: chooseCanonical(codeValues),
      normalizedCode: partKey,
      description: chooseCanonical(partDescriptions.get(partKey)),
      partType: chooseCanonical(partTypes.get(partKey)),
      descriptionVariants: partDescriptions.get(partKey).size,
      typeVariants: partTypes.get(partKey).size,
    })
  }

  return {
    workbookPath,
    sheetName: sheet.name,
    rowCount,
    customers,
    products,
    parts,
    validationErrors,
    sourceTypeCounts,
  }
}

async function compareWithDatabase(source) {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) throw new Error("DATABASE_URL is not configured")

  const prisma = new PrismaClient({
    datasources: { db: { url: cappedDatabaseUrl(rawUrl) } },
  })

  try {
    const existingCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        customer_code: true,
        legal_name: true,
        trading_name: true,
      },
    })
    const existingProducts = await prisma.products.findMany({
      select: {
        id: true,
        product_code: true,
        description: true,
        customer_id: true,
        customer: { select: { legal_name: true, trading_name: true } },
      },
    })
    const existingParts = await prisma.part.findMany({
      select: {
        id: true,
        part_code: true,
        normalized_code: true,
        description: true,
        part_type: true,
      },
    })
    const existingBoms = await prisma.bom.findMany({
      select: {
        id: true,
        revision: true,
        status: true,
        quantity_basis: true,
        product: { select: { id: true, product_code: true } },
        lines: {
          select: {
            quantity: true,
            part: { select: { normalized_code: true } },
          },
        },
      },
    })

    const customerByName = new Map()
    const customerByCode = new Map()
    for (const customer of existingCustomers) {
      addLookup(customerByName, normalizeKey(customer.legal_name), customer)
      addLookup(customerByName, normalizeKey(customer.trading_name), customer)
      customerByCode.set(normalizeKey(customer.customer_code), customer)
    }

    const productByCode = new Map()
    for (const product of existingProducts) {
      addLookup(productByCode, normalizeKey(product.product_code), product)
    }

    const partByCode = new Map()
    for (const part of existingParts) {
      addLookup(partByCode, normalizeKey(part.normalized_code || part.part_code), part)
    }

    const bomByProductCode = new Map()
    for (const bom of existingBoms) {
      addLookup(bomByProductCode, normalizeKey(bom.product.product_code), bom)
    }

    const databaseOnlyCustomers = existingCustomers
      .filter(
        (customer) =>
          !source.customers.has(normalizeKey(customer.legal_name)) &&
          !source.customers.has(normalizeKey(customer.trading_name))
      )
      .map((customer) => ({
        customerCode: customer.customer_code,
        legalName: customer.legal_name,
      }))
    const databaseOnlyProducts = existingProducts
      .filter((product) => !source.products.has(normalizeKey(product.product_code)))
      .map((product) => ({
        productCode: product.product_code,
        description: product.description,
        customer: product.customer?.trading_name || product.customer?.legal_name || "Unassigned",
      }))
    const databaseOnlyParts = existingParts
      .filter(
        (part) =>
          !source.parts.has(normalizeKey(part.normalized_code || part.part_code))
      )
      .map((part) => ({
        partCode: part.part_code,
        partType: part.part_type,
        description: part.description,
      }))

    const customerCreates = []
    const customerMatches = []
    const customerConflicts = []
    const resolvedCustomerIds = new Map()

    for (const customer of source.customers.values()) {
      const matches = customerByName.get(customer.key) ?? []
      const uniqueMatches = [...new Map(matches.map((match) => [match.id, match])).values()]
      if (uniqueMatches.length === 1) {
        customerMatches.push({
          customer: customer.name,
          databaseCode: uniqueMatches[0].customer_code,
        })
        resolvedCustomerIds.set(customer.key, uniqueMatches[0].id)
      } else if (uniqueMatches.length > 1) {
        customerConflicts.push({
          customer: customer.name,
          issue: `Matches ${uniqueMatches.length} database customers`,
        })
      } else {
        const codeCollision = customerByCode.get(normalizeKey(customer.proposedCode))
        if (codeCollision) {
          customerConflicts.push({
            customer: customer.name,
            issue: `Proposed code ${customer.proposedCode} is already used by ${codeCollision.legal_name}`,
          })
        } else {
          customerCreates.push({
            customer: customer.name,
            proposedCode: customer.proposedCode,
          })
        }
      }
    }

    const productCreates = []
    const productMatches = []
    const productUpdates = []
    const productConflicts = []
    const resolvedProductIds = new Map()

    for (const product of source.products.values()) {
      const matches = productByCode.get(product.key) ?? []
      if (matches.length === 0) {
        productCreates.push({
          productCode: product.code,
          customer: product.customerName,
          description: product.description,
        })
        continue
      }
      if (matches.length > 1) {
        productConflicts.push({
          productCode: product.code,
          issue: `Matches ${matches.length} case-insensitive database product codes`,
        })
        continue
      }

      const match = matches[0]
      resolvedProductIds.set(product.key, match.id)
      const sourceCustomerId = resolvedCustomerIds.get(product.customerKey)
      const databaseCustomerName = match.customer?.trading_name || match.customer?.legal_name || "Unassigned"
      const differences = []
      if (!sameText(match.description, product.description)) differences.push("description")
      if (sourceCustomerId && match.customer_id !== sourceCustomerId) differences.push("customer")
      if (!sourceCustomerId && !sameText(databaseCustomerName, product.customerName)) {
        differences.push("customer")
      }

      if (differences.length > 0) {
        productUpdates.push({
          productCode: product.code,
          fields: differences.join(", "),
          databaseCustomer: databaseCustomerName,
          sourceCustomer: product.customerName,
        })
      } else {
        productMatches.push({ productCode: product.code })
      }
    }

    const partCreates = []
    const partMatches = []
    const partUpdates = []
    const partConflicts = []

    for (const part of source.parts.values()) {
      const matches = partByCode.get(part.key) ?? []
      if (matches.length === 0) {
        partCreates.push({
          partCode: part.code,
          partType: part.partType,
          description: part.description,
        })
        continue
      }
      if (matches.length > 1) {
        partConflicts.push({
          partCode: part.code,
          issue: `Matches ${matches.length} database parts`,
        })
        continue
      }

      const match = matches[0]
      const differences = []
      if (!sameText(match.description, part.description)) differences.push("description")
      if (!sameText(match.part_type, part.partType)) differences.push("part type")
      if (differences.length > 0) {
        partUpdates.push({ partCode: part.code, fields: differences.join(", ") })
      } else {
        partMatches.push({ partCode: part.code })
      }
    }

    const bomCreates = []
    const bomMatches = []
    const bomChanges = []
    const bomConflicts = []
    const lineTotals = {
      createWithNewBoms: 0,
      addToExistingBoms: 0,
      updateQuantities: 0,
      removeFromExistingBoms: 0,
      unchanged: 0,
    }

    for (const product of source.products.values()) {
      const productId = resolvedProductIds.get(product.key)
      if (!productId) {
        bomCreates.push({ productCode: product.code, lines: product.lines.size })
        lineTotals.createWithNewBoms += product.lines.size
        continue
      }

      const boms = bomByProductCode.get(product.key) ?? []
      const activeBoms = boms.filter((bom) => bom.status === "ACTIVE")
      const targetBom = activeBoms.sort((left, right) => right.revision - left.revision)[0]
      if (!targetBom) {
        bomCreates.push({ productCode: product.code, lines: product.lines.size })
        lineTotals.createWithNewBoms += product.lines.size
        continue
      }
      if (activeBoms.length > 1) {
        bomConflicts.push({
          productCode: product.code,
          issue: `${activeBoms.length} active BOMs exist`,
        })
      }

      const databaseLines = new Map()
      for (const line of targetBom.lines) {
        const lineKey = normalizeKey(line.part.normalized_code)
        if (databaseLines.has(lineKey)) {
          bomConflicts.push({
            productCode: product.code,
            issue: `Database BOM contains duplicate part ${lineKey}`,
          })
        }
        databaseLines.set(lineKey, Number(line.quantity))
      }

      let adds = 0
      let updates = 0
      let removals = 0
      let unchanged = 0
      for (const [partKey, sourceLine] of product.lines) {
        if (!databaseLines.has(partKey)) {
          adds += 1
        } else if (!sameQuantity(databaseLines.get(partKey), sourceLine.quantity)) {
          updates += 1
        } else {
          unchanged += 1
        }
      }
      for (const partKey of databaseLines.keys()) {
        if (!product.lines.has(partKey)) removals += 1
      }

      lineTotals.addToExistingBoms += adds
      lineTotals.updateQuantities += updates
      lineTotals.removeFromExistingBoms += removals
      lineTotals.unchanged += unchanged

      if (adds || updates || removals) {
        bomChanges.push({
          productCode: product.code,
          activeRevision: targetBom.revision,
          addLines: adds,
          updateQuantities: updates,
          removeLines: removals,
          unchangedLines: unchanged,
        })
      } else {
        bomMatches.push({
          productCode: product.code,
          activeRevision: targetBom.revision,
          lines: unchanged,
        })
      }
    }

    return {
      database: {
        customers: existingCustomers.length,
        products: existingProducts.length,
        parts: existingParts.length,
        boms: existingBoms.length,
        bomLines: existingBoms.reduce((total, bom) => total + bom.lines.length, 0),
        onlyInDatabase: {
          customers: databaseOnlyCustomers,
          products: databaseOnlyProducts,
          parts: databaseOnlyParts,
        },
      },
      customers: {
        create: customerCreates,
        match: customerMatches,
        conflict: customerConflicts,
      },
      products: {
        create: productCreates,
        match: productMatches,
        update: productUpdates,
        conflict: productConflicts,
      },
      parts: {
        create: partCreates,
        match: partMatches,
        update: partUpdates,
        conflict: partConflicts,
      },
      boms: {
        create: bomCreates,
        match: bomMatches,
        change: bomChanges,
        conflict: bomConflicts,
        lineTotals,
      },
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const workbookPath = process.argv[2]
  if (!workbookPath) {
    throw new Error(
      "Usage: node --env-file=.env scripts/dry-run-customer-bom-import.mjs <workbook.xlsx>"
    )
  }

  const source = await readSource(workbookPath)
  console.log("\nCUSTOMER BOM IMPORT DRY RUN")
  console.log("===========================")
  console.table({
    workbookRows: source.rowCount,
    customers: source.customers.size,
    products: source.products.size,
    parts: source.parts.size,
    validationErrors: source.validationErrors.length,
    numericProductCodeRows: source.sourceTypeCounts.numericProductCodes,
    textProductCodeRows: source.sourceTypeCounts.textProductCodes,
    partsWithDescriptionVariants: [...source.parts.values()].filter(
      (part) => part.descriptionVariants > 1
    ).length,
    partsWithTypeVariants: [...source.parts.values()].filter(
      (part) => part.typeVariants > 1
    ).length,
  })

  console.log("\nInput boundaries")
  console.table(BOUNDARIES)
  printExamples("Validation errors", source.validationErrors)
  if (source.validationErrors.length > 0) {
    throw new Error("Workbook validation failed; database comparison was not run")
  }

  const comparison = await compareWithDatabase(source)
  console.log("\nExisting database")
  console.table({
    customers: comparison.database.customers,
    products: comparison.database.products,
    parts: comparison.database.parts,
    boms: comparison.database.boms,
    bomLines: comparison.database.bomLines,
    databaseOnlyCustomers: comparison.database.onlyInDatabase.customers.length,
    databaseOnlyProducts: comparison.database.onlyInDatabase.products.length,
    databaseOnlyParts: comparison.database.onlyInDatabase.parts.length,
  })
  console.log("\nProposed actions")
  console.table({
    customersCreate: comparison.customers.create.length,
    customersMatch: comparison.customers.match.length,
    customerConflicts: comparison.customers.conflict.length,
    productsCreate: comparison.products.create.length,
    productsMatch: comparison.products.match.length,
    productsUpdate: comparison.products.update.length,
    productConflicts: comparison.products.conflict.length,
    partsCreate: comparison.parts.create.length,
    partsMatch: comparison.parts.match.length,
    partsUpdate: comparison.parts.update.length,
    partConflicts: comparison.parts.conflict.length,
    bomsCreate: comparison.boms.create.length,
    bomsMatch: comparison.boms.match.length,
    bomsChange: comparison.boms.change.length,
    bomConflicts: comparison.boms.conflict.length,
    ...comparison.boms.lineTotals,
  })

  printExamples("Customer conflicts", comparison.customers.conflict)
  printExamples("Customers only in database", comparison.database.onlyInDatabase.customers)
  printExamples("Customers to create", comparison.customers.create)
  printExamples("Product conflicts", comparison.products.conflict)
  printExamples("Products only in database", comparison.database.onlyInDatabase.products)
  printExamples("Products to update", comparison.products.update)
  printExamples("Products to create", comparison.products.create)
  printExamples("Part conflicts", comparison.parts.conflict)
  printExamples("Parts only in database", comparison.database.onlyInDatabase.parts)
  printExamples("Parts to update", comparison.parts.update)
  printExamples("Parts to create", comparison.parts.create)
  printExamples("BOM conflicts", comparison.boms.conflict)
  printExamples("Existing BOMs requiring changes", comparison.boms.change)
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    console.error("\nDry run failed:", error.message)
    if (String(error.message).includes("max clients reached")) {
      console.error("Stop local development servers using this database, then rerun the dry run.")
    }
    process.exitCode = 1
  })
}

export { BOUNDARIES, cappedDatabaseUrl, normalizeKey, readSource, sameQuantity, sameText }
