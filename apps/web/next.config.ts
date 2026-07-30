import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oocc/ui", "@oocc/contracts"],
  // `/api/fixtures/[name]` (app/api/fixtures/[name]/route.ts) reads
  // lib/fixtures/data/**/*.json and lib/fixtures/data/**/programs/*.{py,cpp}
  // via a runtime-computed path, which Next's build-time file tracer can't
  // see (it only follows static `import`/`require` graphs) — without
  // this, those files are silently missing from the deployed serverless
  // function's bundle, and every fixture read 500s in production even
  // though it works fine under `next dev`. This tells the tracer to
  // include them explicitly. Paths are relative to this config file.
  //
  // Deliberately pointed *inside* apps/web (lib/fixtures/data, generated
  // by `pnpm --filter @oocc/web gen:fixtures-data`), not at the canonical
  // ../../fixtures/ — Vercel's "Root Directory" project setting (set to
  // apps/web for this monorepo) makes `..` traversal outside the root
  // directory genuinely inaccessible to the deployed app, which broke
  // every fixture on a real deploy the first time this pointed there.
  outputFileTracingIncludes: {
    "/api/fixtures/[name]": ["lib/fixtures/data/**/*"],
  },
};

export default nextConfig;
