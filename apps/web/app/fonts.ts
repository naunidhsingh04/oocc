import { Chivo, IBM_Plex_Mono, JetBrains_Mono, Public_Sans } from "next/font/google";

/**
 * docs/PRD.md §6.2: Chivo (display), Public Sans (body/UI), IBM Plex Mono
 * (data & labels), JetBrains Mono (editor). Each loader assigns the CSS
 * variable that packages/ui/src/theme.css's `--font-*` tokens reference.
 */

export const chivo = Chivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-chivo",
  display: "swap",
});

export const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-public-sans",
  display: "swap",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = [
  chivo.variable,
  publicSans.variable,
  ibmPlexMono.variable,
  jetbrainsMono.variable,
].join(" ");
