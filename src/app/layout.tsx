import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { AuthProvider } from "@/lib/auth";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--display-font" });
const body = DM_Sans({ subsets: ["latin"], variable: "--body-font" });

export const metadata: Metadata = {
  title: "Shared EB Bill — Meter Management",
  description: "Split a single EB meter bill across homes with sub-meters.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body><AuthProvider><Shell>{children}</Shell></AuthProvider></body>
    </html>
  );
}
