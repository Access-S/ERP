import type { NextConfig } from "next";

const cloudShellOrigin = process.env.CLOUD_SHELL_ORIGIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    ...(cloudShellOrigin ? [cloudShellOrigin] : []),
  ],
};

export default nextConfig;
