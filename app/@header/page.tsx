import Image from "next/image";
import Link from "next/link";

import { getCities } from "@/app/_db/City";
import { City } from "@/app/_db/schema";
import { ExternalLink } from "@/components/ui/ExternalLink";

import logo from "@/static/logo.svg";

export default async function Header({
  searchParams,
}: {
  searchParams?: {
    city?: string;
  };
}) {
  const cities: City[] = await getCities();
  const selectedCity = searchParams?.city
    ? cities.find((city) => city.id == searchParams.city)
    : undefined;

  return (
    <header>
      <div className="flex items-center justify-between">
        <h1 className="flex items-baseline gap-2 text-3xl font-bold">
          <Link href="/" className="contents">
            <Image src={logo} alt="meet.hn logo" width="40" height="40" />
            meet.hn
          </Link>
        </h1>
        <ul className="flex gap-2">
          {selectedCity ? (
            <li>
              <Link href="/">Register</Link>
            </li>
          ) : null}
        </ul>
      </div>
      <p className="text-sm text-gray-400">
        by <ExternalLink href="https://x.com/borisfyi">@borisfyi</ExternalLink>
      </p>
    </header>
  );
}
