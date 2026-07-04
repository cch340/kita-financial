import type { Metadata, Viewport } from "next";
import { Public_Sans, Noto_Sans_SC } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-cjk",
});

export const metadata: Metadata = {
  title: "Kita",
  description: "Kita family finance tracker",
  // Icons come from the app/ file conventions: `icon.svg` (browser tab, crisp at
  // any size) and `apple-icon.png` (iOS Add-to-Home-Screen — iOS ignores the web
  // manifest and needs an opaque 180×180 apple-touch-icon). Android install icons
  // come from the web manifest (app/manifest.ts → /icons/*).
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kita" },
};

// viewport-fit=cover is required for env(safe-area-inset-*) to resolve to real
// values on notched phones — the bottom tab bar's safe-area padding depends on it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${publicSans.variable} ${notoSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
