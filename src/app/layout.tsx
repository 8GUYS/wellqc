import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PWAClient } from "@/components/pwa/pwa-client";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "WellQC | AI-Powered Well Log Quality Assurance Platform",
  description: "Enterprise petrophysical well log validation, standardisation, and quality assurance cloud platform.",
  applicationName: "WellQC",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WellQC",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/wellqc-icon.svg", type: "image/svg+xml" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/SFPRODISPLAYREGULAR.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/SFPRODISPLAYBOLD.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-wellqc-dark text-wellqc-text min-h-screen font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <Script
          id="wellqc-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('wellqc_theme') || 'slate';
                  document.documentElement.setAttribute('data-theme', saved);
                  if (saved === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                  if (saved === 'custom') {
                    var customRaw = localStorage.getItem('wellqc_custom_theme');
                    if (customRaw) {
                      var c = JSON.parse(customRaw);
                      var r = document.documentElement.style;
                      if (c.isGradient) {
                        r.setProperty('--wellqc-dark', 'linear-gradient(' + (c.bgAngle || '135deg') + ', ' + c.bgStart + ', ' + c.bgEnd + ')');
                      } else {
                        r.setProperty('--wellqc-dark', c.bgStart || '#090d16');
                      }
                      if (c.panel) r.setProperty('--wellqc-panel', c.panel);
                      if (c.card) r.setProperty('--wellqc-card', c.card);
                      if (c.border) r.setProperty('--wellqc-border', c.border);
                      if (c.accent) {
                        r.setProperty('--wellqc-accent', c.accent);
                        r.setProperty('--wellqc-cyan', c.accent);
                      }
                      if (c.isLight) {
                        document.documentElement.classList.remove('dark');
                        r.setProperty('--wellqc-text', '#1c1917');
                        r.setProperty('--wellqc-muted', '#78716c');
                      } else {
                        document.documentElement.classList.add('dark');
                        r.setProperty('--wellqc-text', '#f8fafc');
                        r.setProperty('--wellqc-muted', '#94a3b8');
                      }
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          {children}
          <PWAClient />
        </ThemeProvider>
      </body>
    </html>
  );
}
