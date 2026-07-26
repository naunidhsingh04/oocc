import { AppShell } from "@/components/AppShell";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
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
      <body className="font-body antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
