export const THEME_IDS = ["slate", "paper", "midnight", "sepia", "mist"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeMeta {
  label: string;
  /** Swatch preview colors for the header picker — the theme's own page
   * background and accent, not an arbitrary illustrative pair. */
  swatchBg: string;
  swatchAccent: string;
  dark: boolean;
}

/** docs/PRD.md §6 — five presets, Paper default. Order here is the order
 * the header picker renders them in. */
export const THEME_META: Record<ThemeId, ThemeMeta> = {
  slate: { label: "Slate", swatchBg: "#161b22", swatchAccent: "#4ec9b0", dark: true },
  paper: { label: "Paper", swatchBg: "#faf8f5", swatchAccent: "#1d9e75", dark: false },
  midnight: { label: "Midnight", swatchBg: "#12172b", swatchAccent: "#7f77dd", dark: true },
  sepia: { label: "Sepia", swatchBg: "#23201c", swatchAccent: "#ef9f27", dark: true },
  mist: { label: "Mist", swatchBg: "#f4f6f8", swatchAccent: "#378adb", dark: false },
};

export const DEFAULT_THEME: ThemeId = "paper";
export const THEME_STORAGE_KEY = "oocc-theme";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
