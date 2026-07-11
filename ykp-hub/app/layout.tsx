import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "YKP ERP — Unified Dashboard",
  description: "Single dashboard for HR, Finance, Hermez, dan HR Pilot"
};

/**
 * Inline theme bootstrap: runs before React hydrates to avoid FOUC.
 * Reads localStorage 'ykp_hub_theme' and applies 'dark' class to <html>
 * if value === 'dark' OR if value === 'system' AND prefers-color-scheme dark.
 */
const themeBootstrap = `
(function() {
  try {
    var t = localStorage.getItem('ykp_hub_theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--fg))] antialiased">{children}</body>
    </html>
  );
}