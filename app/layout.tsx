import { VercelToolbar } from "@vercel/toolbar/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { preconnect } from "react-dom";

import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import MapComponent from "@/components/MapComponent";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://meet.hn"),
  title: "meet.hn",
  description: "Meet the Hacker News community in your city",
  openGraph: {
    siteName: "meet.hn",
    title: "meet.hn",
    description: "Meet the Hacker News community in your city",
    url: "https://meet.hn",
    images: [
      {
        url: "og-800-600.png",
        width: 800,
        height: 600,
      },
    ],
  },
};

export const dynamic = "error";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shouldInjectToolbar = process.env.NODE_ENV === "development";
  // The mobile LCP element is a map tile: open its connection while the
  // page's JS is still downloading rather than once Leaflet asks for tiles.
  preconnect("https://tile.openstreetmap.org");

  return (
    <html lang="en">
      <body className={`bg-[#f6f6ef] ${inter.className}`}>
        <main className="grid overflow-hidden md:h-dvh md:grid-cols-[max-content,1fr]">
          <div className="flex flex-col gap-8 overflow-x-hidden overflow-y-scroll p-5 md:w-[512px]">
            {children}
          </div>
          <MapComponent />
        </main>
        {shouldInjectToolbar && <VercelToolbar />}
      </body>
      <GoogleAnalytics gaId="G-DWDYDS8TCD" />
    </html>
  );
}
