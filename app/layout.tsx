import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Meet HN",
  description: "Meet the HN community in real life",
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
      </body>
      <GoogleAnalytics gaId="G-DWDYDS8TCD" />
    </html>
  );
}
