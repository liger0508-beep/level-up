import type { NextConfig } from "next";

const nextConfig: any = {
  allowedDevOrigins: ["192.168.123.113", "localhost:3000"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
