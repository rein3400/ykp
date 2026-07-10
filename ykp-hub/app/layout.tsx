import "./globals.css";

export const metadata = {
  title: "YKP ERP — Unified Dashboard",
  description: "Single dashboard for HR, Finance, Hermez, dan HR Pilot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
