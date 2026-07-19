import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YKP Owner Command',
  description: 'Dashboard komando owner — visibilitas lintas modul YKP ERP (read-only)'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='id'>
      <body>{children}</body>
    </html>
  );
}
