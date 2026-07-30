import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oocc/ui", "@oocc/contracts"],
  // `/api/fixtures/[name]` (app/api/fixtures/[name]/route.ts) reads
  // fixtures/**/*.json and fixtures/**/programs/*.{py,cpp} via a
  // runtime-computed path, which Next's build-time file tracer can't see
  // (it only follows static `import`/`require` graphs) — without this,
  // those files are silently missing from the deployed serverless
  // function's bundle, and every fixture read 404s/500s in production
  // (e.g. on Vercel) even though it works fine under `next dev`, where
  // the whole repo is on disk. This tells the tracer to include them
  // explicitly. Paths are relative to this config file.
  outputFileTracingIncludes: {
    "/api/fixtures/[name]": ["../../fixtures/**/*"],
  },
};

export default nextConfig;
