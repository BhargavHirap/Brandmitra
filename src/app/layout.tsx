import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vantra — The AI operating system for modern businesses",
    template: "%s · Vantra",
  },
  description:
    "Vantra gives every business an AI-generated storefront, an order desk, customer tools and an AI business agent — in one platform.",
  applicationName: "Vantra",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Vantra",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
  },
  appleWebApp: {
    capable: true,
    title: "Vantra",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
