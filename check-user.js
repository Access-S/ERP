require("dotenv").config({ path: ".env.local" });

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "admin@mrp.com" }
  });

  if (!user) {
    console.log("USER NOT FOUND");
    return;
  }

  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    passwordLength: user.password?.length,
    passwordPrefix: user.password?.substring(0, 4)
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
