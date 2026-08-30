require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const customers = [
  {
    customer_code: "KENV",
    legal_name: "Johnson & Johnson Pacific Pty Limited",
    trading_name: "Kenvue",
    industry: "Pharmaceutical / Healthcare",
  },
  {
    customer_code: "PG",
    legal_name: "Procter & Gamble Australia Pty. Limited",
    trading_name: "Procter & Gamble",
    industry: "FMCG / Consumer Goods",
  },
  {
    customer_code: "HALE",
    legal_name: "Haleon Australia Pty Ltd",
    trading_name: "Haleon",
    industry: "Pharmaceutical / Healthcare",
  },
  {
    customer_code: "UNIL",
    legal_name: "Unilever Australia Limited",
    trading_name: "Unilever",
    industry: "FMCG / Consumer Goods",
  },
  {
    customer_code: "COLG",
    legal_name: "Colgate-Palmolive Pty Ltd",
    trading_name: "Colgate-Palmolive",
    industry: "FMCG / Consumer Goods",
  },
  {
    customer_code: "BLUE",
    legal_name: "Bluegum Pharma Holdings Pty Limited",
    trading_name: "Bluegum Pharmaceuticals",
    industry: "Pharmaceutical / Healthcare",
  },
  {
    customer_code: "BIOG",
    legal_name: "BioGaia Australia Pty Ltd",
    trading_name: "BioGaia",
    industry: "Pharmaceutical / Healthcare",
  },
  {
    customer_code: "KCL",
    legal_name: "Kimberly-Clark Australia Pty. Limited",
    trading_name: "Kimberly-Clark",
    industry: "FMCG / Consumer Goods",
  },
  {
    customer_code: "GALD",
    legal_name: "Galderma Australia Pty Ltd",
    trading_name: "Galderma",
    industry: "Pharmaceutical / Healthcare",
  },
  {
    customer_code: "BOEI",
    legal_name: "Boehringer Ingelheim Pty Ltd",
    trading_name: "Boehringer Ingelheim",
    industry: "Pharmaceutical / Healthcare",
  },
  {
    customer_code: "SELL",
    legal_name: "DuluxGroup (Australia) Pty Ltd",
    trading_name: "Selleys",
    industry: "Building Products / Adhesives",
  },
];

async function main() {
  console.log("Starting customer seed...\n");

  for (const customer of customers) {
    let existing = await prisma.customer.findUnique({
      where: { customer_code: customer.customer_code },
    });

    if (!existing) {
      existing = await prisma.customer.findFirst({
        where: { trading_name: customer.trading_name },
      });
    }

    if (!existing) {
      existing = await prisma.customer.findFirst({
        where: { legal_name: customer.legal_name },
      });
    }

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          customer_code: customer.customer_code,
          legal_name: customer.legal_name,
          trading_name: customer.trading_name,
          industry: customer.industry,
          status: "ACTIVE",
          default_currency: "AUD",
          is_active: true,
        },
      });

      console.log(`UPDATED: ${customer.customer_code} - ${customer.trading_name}`);
    } else {
      await prisma.customer.create({
        data: {
          customer_code: customer.customer_code,
          legal_name: customer.legal_name,
          trading_name: customer.trading_name,
          industry: customer.industry,
          status: "ACTIVE",
          default_currency: "AUD",
          is_active: true,
        },
      });

      console.log(`CREATED: ${customer.customer_code} - ${customer.trading_name}`);
    }
  }

  console.log("\nCustomer seed completed.");
}

main()
  .catch((error) => {
    console.error("\nERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
