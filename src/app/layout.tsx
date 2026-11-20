import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Brandmitra — The AI operating system for modern businesses",
    template: "%s · Brandmitra",
  },
  description:
    "Brandmitra gives every business an AI-generated storefront, an order desk, customer tools and an AI business agent — in one platform.",
  applicationName: "Brandmitra",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
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
