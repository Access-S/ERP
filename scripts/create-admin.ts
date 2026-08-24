// scripts/create-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Initialize a standalone Prisma Client for the script
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@mrp.com';
  const password = 'password123'; // You can change this
  const name = 'Admin User';
  const role = 'ADMIN'; // This gives full access to everything

  // Hash the password securely
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create or update the user in your Supabase database
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: role,
      name: name
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role,
    },
  });

  console.log('✅ Test Admin User created successfully!');
  console.log('Email:', user.email);
  console.log('Role:', user.role);
}

main()
  .catch((e) => {
    console.error('Error creating user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });