// ───────────────── BLOCK 1: Next Config ────────────────────────────
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    // Old domain (kept in case it rotates back)
    '3000-cs-e43b9a06-d1be-403c-a83d-6432822ed3f7.cs-asia-southeast1-ajrg.cloudshell.dev',
    // New domain
    '3000-cs-c657adc4-6030-446e-bd9b-4a8314f0b202.cs-asia-southeast1-palm.cloudshell.dev'
  ],
};

export default nextConfig;