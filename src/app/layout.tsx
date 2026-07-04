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
  // iOS "Add to Home Screen" ignores the web-manifest icons and uses the
  // apple-touch-icon; without it iOS shows a screenshot of the page. Must be an
  // opaque 180×180 (iOS applies its own rounded-corner mask).
  icons: {
    icon: [
      { url: "/icons/kita-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/kita-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
