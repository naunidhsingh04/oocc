import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oocc/ui", "@oocc/contracts"],
};

export default nextConfig;
