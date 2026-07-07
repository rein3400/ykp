import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'YKP HR V1',
  description: 'YKP ERP HR Module V1'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='id'>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}