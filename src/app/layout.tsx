import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WellQC+ | AI-Powered Well Log Quality Assurance Platform",
  description: "Enterprise petrophysical well log validation, standardisation, and quality assurance cloud platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-wellqc-dark text-slate-100 min-h-screen antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
