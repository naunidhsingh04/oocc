import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import ooccPlugin from "@oocc/ui/eslint-plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // next-env.d.ts is auto-generated and managed by Next.js itself (its own
  // header says not to hand-edit it); its triple-slash reference is how
  // Next wires up generated route types and trips
  // @typescript-eslint/triple-slash-reference if linted.
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { oocc: ooccPlugin },
    rules: {
      "oocc/no-decorative-utilities": "error",
      "oocc/no-emoji-jsx": "error",
    },
  },
];

export default eslintConfig;
