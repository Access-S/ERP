// ---------------- BLOCK 1: Imports and Constants ----------------
import assert from "node:assert/strict"
import { Prisma, PrismaClient } from "@prisma/client"
import { createCustomerInputSchema } from "../src/features/customers/types/customer-schema.ts"
import { createProductInputSchema } from "../src/features/products/types/product-schema.ts"
import { createPartInputSchema } from "../src/features/parts/types/part-schema.ts"
import { addBomLineSchema } from "../src/features/boms/types/bom-schema.ts"

const prisma = new PrismaClient()
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

class ExpectedRollback extends Error {}

// ---------------- BLOCK 2: Test Helpers ----------------
function pass(name) {
  console.log(`PASS  ${name}`)
}

async function rollbackScenario(name, callback) {
  let completed = false
  try {
    await prisma.$transaction(async (transaction) => {
      await callback(transaction)
      completed = true
      throw new ExpectedRollback("Rollback UAT data")
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error
  }
  assert.equal(completed, true, `${name} did not reach its final assertion`)
  pass(name)
}

async function expectUniqueViolation(name, callback) {
  let errorCode = null
  try {
    await prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (error) {
    errorCode = error?.code ?? null
  }
  assert.equal(errorCode, "P2002", `${name} should fail with Prisma P2002`)
  pass(name)
}

async function recordCounts() {
  const [customers, products, boms, bomLines, parts, purchaseOrders] = await Promise.all([
    prisma.customer.count(),
    prisma.products.count(),
    prisma.bom.count(),
    prisma.bomLine.count(),
    prisma.part.count(),
    prisma.purchase_orders.count(),
  ])
  return { customers, products, boms, bomLines, parts, purchaseOrders }
}

// ---------------- BLOCK 3: Boundary Validation ----------------
function validateBoundaries() {
  const customerInput = {
    customerCode: `UAT-CUST-${suffix}`,
    legalName: "UAT Customer Pty Ltd",
    tradingName: "UAT Customer",
    customerType: "STANDARD",
    industry: "Testing",
    paymentTerms: "30 Days",
    creditLimit: "10000",
    defaultCurrency: "aud",
    defaultDiscountPercentage: "2.5",
    taxId: "",
    isTaxExempt: false,
    primaryContactName: "Test User",
    primaryContactEmail: "uat@example.test",
    primaryContactPhone: "0000000000",
    accountsPayablesEmail: "accounts@example.test",
    notes: "Rolled-back UAT record",
  }
  assert.equal(createCustomerInputSchema.safeParse(customerInput).success, true)
  assert.equal(createCustomerInputSchema.safeParse({
    ...customerInput,
    primaryContactEmail: "not-an-email",
  }).success, false)

  const productInput = {
    productCode: `UAT-PROD-${suffix}`,
    description: "UAT Product",
    customerId: null,
    unitsPerShipper: "12",
    uom: "Each",
    category: "Testing",
    dailyRunRate: "100",
    hourlyRunRate: "10",
    minsPerShipper: "6",
    pricePerShipper: "25",
  }
  assert.equal(createProductInputSchema.safeParse(productInput).success, true)
  assert.equal(createProductInputSchema.safeParse({
    ...productInput,
    unitsPerShipper: "0",
  }).success, false)

  assert.equal(createPartInputSchema.safeParse({
    partCode: `UAT-PART-${suffix}`,
    description: "UAT Part",
    partType: "Testing",
    defaultUom: "Each",
  }).success, true)
  assert.equal(addBomLineSchema.safeParse({
    bomId: "00000000-0000-4000-8000-000000000000",
    partId: "00000000-0000-4000-8000-000000000001",
    quantity: 0,
    uom: "Each",
  }).success, false)
  pass("Zod mutation boundaries")
}

// ---------------- BLOCK 4: Reversible Workflow ----------------
async function testMasterDataWorkflow() {
  await rollbackScenario("Customer -> Product -> draft BOM -> Part -> active BOM", async (transaction) => {
    const customer = await transaction.customer.create({
      data: {
        customer_code: `UAT-CUST-${suffix}`,
        legal_name: "UAT Customer Pty Ltd",
        trading_name: "UAT Customer",
      },
    })

    const product = await transaction.products.create({
      data: {
        product_code: `UAT-PROD-${suffix}`,
        description: "UAT Product",
        customer_id: customer.id,
        units_per_shipper: 12,
        boms: { create: { revision: 1, status: "DRAFT" } },
      },
      include: { boms: true },
    })
    assert.equal(product.boms.length, 1)
    assert.equal(product.boms[0].status, "DRAFT")

    const partCode = `UAT-PART-${suffix}`
    const part = await transaction.part.create({
      data: {
        part_code: partCode,
        normalized_code: partCode.toUpperCase(),
        description: "UAT Part",
        part_type: "Testing",
        default_uom: "Each",
      },
    })

    await transaction.bomLine.create({
      data: {
        bom_id: product.boms[0].id,
        part_id: part.id,
        quantity: 2,
        uom: "Each",
        position: 1,
      },
    })
    await transaction.bom.update({
      where: { id: product.boms[0].id },
      data: { status: "ACTIVE" },
    })

    await transaction.purchase_orders.create({
      data: {
        po_number: `UAT-PO-${suffix}`,
        sequence: 1,
        product_id: product.id,
        customer_id: customer.id,
        customer_name: customer.trading_name,
        ordered_qty_pieces: 12,
        ordered_qty_shippers: 1,
        customer_amount: 25,
        system_amount: 25,
        current_status: "Open",
      },
    })

    const [activePartUsage, activeProducts, liveOrders] = await Promise.all([
      transaction.bomLine.count({
        where: { part_id: part.id, bom: { status: "ACTIVE" } },
      }),
      transaction.products.count({
        where: { customer_id: customer.id, is_active: true },
      }),
      transaction.purchase_orders.count({
        where: {
          customer_id: customer.id,
          current_status: { in: ["Open", "PO Check"] },
        },
      }),
    ])
    assert.equal(activePartUsage, 1)
    assert.equal(activeProducts, 1)
    assert.equal(liveOrders, 1)
  })
}

// ---------------- BLOCK 5: Database Constraints ----------------
async function testUniqueConstraints() {
  await expectUniqueViolation("Normalized Customer-code uniqueness", async (transaction) => {
    const code = `UAT CUSTOMER ${suffix}`
    await transaction.customer.create({ data: { customer_code: code, legal_name: "One" } })
    await transaction.customer.create({
      data: { customer_code: `uat   customer ${suffix}`, legal_name: "Two" },
    })
  })

  await expectUniqueViolation("Normalized Product-code uniqueness", async (transaction) => {
    const code = `UAT PRODUCT ${suffix}`
    await transaction.products.create({ data: { product_code: code } })
    await transaction.products.create({ data: { product_code: `uat   product ${suffix}` } })
  })

  await expectUniqueViolation("One draft BOM per Product", async (transaction) => {
    const product = await transaction.products.create({
      data: {
        product_code: `UAT-DRAFT-${suffix}`,
        boms: { create: { revision: 1, status: "DRAFT" } },
      },
    })
    await transaction.bom.create({
      data: { product_id: product.id, revision: 2, status: "DRAFT" },
    })
  })

  await expectUniqueViolation("One active BOM per Product", async (transaction) => {
    const product = await transaction.products.create({
      data: {
        product_code: `UAT-ACTIVE-${suffix}`,
        boms: { create: { revision: 1, status: "ACTIVE" } },
      },
    })
    await transaction.bom.create({
      data: { product_id: product.id, revision: 2, status: "ACTIVE" },
    })
  })
}

// ---------------- BLOCK 6: Runner ----------------
async function main() {
  const before = await recordCounts()
  validateBoundaries()
  await testMasterDataWorkflow()
  await testUniqueConstraints()
  const after = await recordCounts()
  assert.deepEqual(after, before, "UAT must not persist any records")
  pass("All UAT records rolled back")
  console.log(`\nBaseline preserved: ${JSON.stringify(after)}`)
}

main()
  .catch((error) => {
    console.error("FAIL ", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
