import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YKP Marketing',
  description: 'YKP Marketing — Panduan Meta & Arahan Konten (preview)'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
