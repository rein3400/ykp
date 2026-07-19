import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YKP Finance V1',
  description: 'YKP ERP Finance Module V1 — pusat kontrol uang YKP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='id'>
      <body>{children}</body>
    </html>
  );
}
