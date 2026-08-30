import type { NextConfig } from "next";

const cloudShellOrigin = process.env.CLOUD_SHELL_ORIGIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: cloudShellOrigin
    ? [cloudShellOrigin]
    : [],
};

export default nextConfig;