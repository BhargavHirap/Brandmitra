import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vantra — The AI operating system for modern businesses",
    template: "%s · Vantra",
  },
  description:
    "Vantra gives every business an AI-generated storefront, an order desk, customer tools and an AI business agent — in one platform.",
  applicationName: "Vantra",
  manifest: "/manifest.webmanifest",
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
