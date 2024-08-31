"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ExternalLink } from "@/components/ui/ExternalLink";

import logo from "@/public/logo.svg";

// Fixes:
// useSearchParams() should be wrapped in a suspense boundary at page "/".
// Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
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
    <header className="grid grid-cols-1 grid-rows-2 items-baseline gap-2 md:grid-cols-2 md:grid-rows-2">
      <h1 className="flex items-baseline gap-2 text-3xl font-bold">
        <Link href="/" className="contents">
          <Image src={logo} alt="meet.hn logo" width="40" height="40" />
          meet.hn
        </Link>
      </h1>
      <p className="hidden text-sm text-gray-400 md:row-start-2 md:inline-block">
        by <ExternalLink href="https://x.com/borisfyi">@borisfyi</ExternalLink>
      </p>
      <ul className="flex gap-2 text-base md:justify-self-end">
        {city || pathname !== "/" ? (
          <>
            <li>
              <Link
                href="/"
                className="underline underline-offset-2 md:no-underline"
              >
                Register
              </Link>
            </li>
            <li>·</li>
          </>
        ) : null}
        <li>
          <Link
            href="/feedback"
            className="underline underline-offset-2 md:no-underline"
          >
            Feedback
          </Link>
        </li>
        <li>·</li>
        <li>
          <Link
            href="/delete"
            className="underline underline-offset-2 md:no-underline"
          >
            Delete
          </Link>
        </li>
      </ul>
    </header>
  );
}
