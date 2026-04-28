import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', 'ai.dwipa.my.id', 'dwipa.my.id'],
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
