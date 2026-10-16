import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { FooterBar } from "@/components/layout/FooterBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Providers } from "@/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "COGITEX VIDE CORTEX", template: "COGITEX VIDE CORTEX — %s" },
  description: "Industrial fault detection and predictive maintenance control room.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the saved theme before first paint so there is no flash of the wrong theme.
 * Must stay tiny and dependency-free; key name matches STORAGE_KEYS.theme.
 */
const THEME_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem("vide_theme")==="light"?"light":"dark"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 px-4 py-[22px] md:px-[26px]">{children}</main>
              <FooterBar />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
