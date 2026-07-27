/**
 * The user's own Gemini API key (docs/PRD.md §4.5): lives in
 * `localStorage` only, sent per-request as `X-Provider-Key`, never touches
 * a Next.js server or route handler — every read here is client-side.
 */

const STORAGE_KEY = "oocc.provider-key";

export function getStoredProviderKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredProviderKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredProviderKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Loose shape check only — real validation is a server round trip
 * (`validateProviderKey` in lib/api/client.ts). This just catches empty/
 * obviously-wrong input before spending a network call on it. */
export function looksLikeAKey(value: string): boolean {
  return value.trim().length >= 8;
}
