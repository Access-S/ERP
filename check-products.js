require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.products.findMany({
    take: 20,
    orderBy: {
      product_code: "asc",
    },
    select: {
      product_code: true,
      description: true,
      customer_id: true,
      category: true,
      uom: true,
      is_active: true,
    },
  });

  console.table(products);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
