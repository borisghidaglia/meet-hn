import { GoogleAnalytics } from "@next/third-parties/google";
import { VercelToolbar } from "@vercel/toolbar/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

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

export default function RootLayout({
  header,
  sidebar,
  map,
}: Readonly<{
  header: React.ReactNode;
  sidebar: React.ReactNode;
  map: React.ReactNode;
}>) {
  const shouldInjectToolbar = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body className={`bg-[#f6f6ef] ${inter.className}`}>
        <main className="grid overflow-hidden md:h-dvh md:grid-cols-[max-content,1fr]">
          <div className="flex flex-col gap-8 overflow-x-hidden overflow-y-scroll p-5 md:w-[512px]">
            {header}
            {sidebar}
          </div>
          {map}
        </main>
        {shouldInjectToolbar && <VercelToolbar />}
      </body>
      <GoogleAnalytics gaId="G-DWDYDS8TCD" />
    </html>
  );
}
