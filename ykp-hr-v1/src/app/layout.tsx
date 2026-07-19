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
      {/* suppressHydrationWarning: browser extensions (password managers,
          grammar tools, AI assistants) inject attributes/classes into <body>
          before React hydrates — that's external noise, not app bugs. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}