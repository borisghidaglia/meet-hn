"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ExternalLink } from "@/components/ui/ExternalLink";

import logo from "@/public/logo.svg";

export default function SuspensedHeader() {
  return (
    <Suspense>
      <Header />
    </Suspense>
  );
}

function Header() {
  const searchParams = useSearchParams();
  const city = searchParams.get("city");
  const pathname = usePathname();

  return (
    <header>
      <div className="flex items-baseline justify-between">
        <h1 className="flex items-baseline gap-2 text-3xl font-bold">
          <Link href="/" className="contents">
            <Image src={logo} alt="meet.hn logo" width="40" height="40" />
            meet.hn
          </Link>
        </h1>
        <ul className="flex gap-2">
          {city || pathname !== "/" ? (
            <>
              <li>
                <Link href="/" className="hover:underline">
                  Register
                </Link>
              </li>
              <li>·</li>
            </>
          ) : null}
          <li>
            <Link href="/delete" className="hover:underline">
              Delete
            </Link>
          </li>
        </ul>
      </div>
      <p className="text-sm text-gray-400">
        by <ExternalLink href="https://x.com/borisfyi">@borisfyi</ExternalLink>
      </p>
    </header>
  );
}
