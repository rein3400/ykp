import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YKP Operational V1',
  description: 'YKP ERP Operational Module V1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='id'>
      <body>{children}</body>
    </html>
  );
}
