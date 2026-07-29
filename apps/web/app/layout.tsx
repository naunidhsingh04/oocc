import { AppShell } from "@/components/AppShell";
import { THEME_NO_FLASH_SCRIPT, ThemeProvider } from "@/lib/theme/ThemeProvider";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "OOCC",
  description: "A visual execution environment for learning computer science.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Must run before first paint to avoid a flash of the wrong theme;
            see lib/theme/ThemeProvider.tsx's THEME_NO_FLASH_SCRIPT docstring. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_NO_FLASH_SCRIPT }} />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
