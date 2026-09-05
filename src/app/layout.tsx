import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { Polyfills } from "@/components/polyfills";
import "./globals.css";

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "RH Burner OS — Burner wallet for ETH, Base, Arbitrum & RH",
  description:
    "Use your burner.pro hardware wallet on Ethereum, Base, Arbitrum, and Robinhood Chain. ENS resolution and Safe.global via WalletConnect.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg` },
  metadataBase: new URL("https://z80.wtf/burner"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} dark h-full antialiased`}
    >
      <body className="min-h-full font-sans text-foreground">
        <Polyfills />
        {children}
      </body>
    </html>
  );
}
