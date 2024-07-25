import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import "./globals.css";

import { ExternalLink } from "@/components/ui/ExternalLink";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Meet HN",
  description: "Meet the HN community in real life",
};

export default function RootLayout({
  sidebar,
  map,
}: Readonly<{
  sidebar: React.ReactNode;
  map: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`bg-[#f6f6ef] ${inter.className}`}>
        <main className="grid overflow-hidden md:h-dvh md:grid-cols-[max-content,1fr]">
          <div className="flex flex-col gap-8 overflow-scroll p-5 md:w-[512px]">
            <header>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">
                  <Link href="/">meet.hn</Link>
                </h1>
                <ul className="flex gap-2">
                  <li>
                    <Link href="/">Register</Link>
                  </li>
                </ul>
              </div>
              <p className="text-sm text-gray-400">
                by{" "}
                <ExternalLink href="https://x.com/borisfyi">
                  @borisfyi
                </ExternalLink>
              </p>
            </header>
            {sidebar}
          </div>
          {map}
        </main>
      </body>
    </html>
  );
}
