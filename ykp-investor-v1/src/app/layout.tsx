import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'YKP Investor V1', description: 'YKP Investor Dashboard + Cap Table' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang='id'><body>{children}</body></html>);
}