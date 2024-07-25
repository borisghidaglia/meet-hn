import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, Suspense } from "react";

import { getCities } from "@/app/_db/City";
import { City, DbUser } from "@/app/_db/schema";
import { getClientUser, getUsers } from "@/app/_db/User";
import { CopyToClipboardBtn } from "@/components/CopyToClipboardBtn";
import { GroupToggle, GroupToggleItem } from "@/components/GroupToggle";
import { SignUpForm } from "@/components/SignUpForm";
import { Socials } from "@/components/Socials";
import { ExternalLink } from "@/components/ui/ExternalLink";

const MapContainer = dynamic(() => import("@/components/MapContainer"), {
  ssr: false,
});

export default async function Home({
  searchParams,
}: {
  searchParams?: {
    city?: string;
  };
}) {
  const uuid = `meet.hn-${crypto.randomUUID()}`;
  const cities: City[] = await getCities();
  const selectedCity = searchParams?.city
    ? cities.find((city) => city.id == searchParams.city)
    : null;

  return (
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
            <ExternalLink href="https://x.com/borisfyi">@borisfyi</ExternalLink>
          </p>
        </header>
        <Suspense fallback={"Loading..."}>
          {selectedCity ? (
            <div>
              <p className="text-3xl">
                {getFlagEmoji(selectedCity.countryCode)}
              </p>
              <p>
                <span className="mr-2 text-xl font-semibold">
                  {selectedCity.hackers}
                </span>
                {selectedCity.hackers > 1 ? "hackers" : "hacker"} in{" "}
                {selectedCity.name}, {selectedCity.country}{" "}
              </p>
              <GroupToggle>
                <UserTable city={selectedCity} />
              </GroupToggle>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p>
                  To register, add this UUID to the about section of your HN
                  profile.
                </p>
                <div className="grid grid-cols-1 grid-rows-1 rounded-sm border border-[#aaaaa4e3] bg-[#e3e3dce3] px-2 py-1">
                  <p className="col-start-1 row-start-1">{uuid}</p>
                  <CopyToClipboardBtn
                    text={uuid}
                    className="col-start-1 row-start-1 place-self-end self-center fill-black p-1"
                  />
                </div>
              </div>
              <details>
                <summary className="cursor-pointer">
                  Add your socials (full) links to your HN profile's about
                  section, and they'll show up here.
                </summary>
                <p className="mt-2">
                  Supported:{" "}
                  <ExternalLink href="https://at.hn/" className="font-medium">
                    at.ht
                  </ExternalLink>{" "}
                  from{" "}
                  <ExternalLink
                    href="https://x.com/padolsey"
                    className="font-medium"
                  >
                    @padolsey
                  </ExternalLink>
                  , Bluesky, Instagram, LinkedIn, Reddit, Soundcloud, Spotify,
                  X/Twitter, YouTube Music
                </p>
              </details>
              <details>
                <summary className="cursor-pointer">
                  Finally, enter your HN username, city and country below.
                </summary>
                <p className="mt-2">
                  City and country should be comma separated. It uses{" "}
                  <ExternalLink
                    href="https://nominatim.org/release-docs/develop/api/Search/#free-form-query"
                    className="underline"
                  >
                    Nominatim free form query search API External{" "}
                  </ExternalLink>{" "}
                  so the input format is pretty flexible. Ideally, use a big
                  city near you.
                </p>
                <div>
                  <p>Examples:</p>
                  <ul className="list-inside list-disc">
                    <li>Paris, France</li>
                    <li>SF, USA</li>
                  </ul>
                </div>
              </details>
              <SignUpForm uuid={uuid} />
              <p>
                If you do meet in real life and want to share a pic on Twitter,
                tag the{" "}
                <ExternalLink
                  href="https://x.com/meet_hn"
                  className="font-medium"
                >
                  @meet_hn
                </ExternalLink>{" "}
                account and I'll retweet you.
              </p>
              <p>
                To give some feedback or remove your profile from meet.hn, drop
                me a DM on Twitter{" "}
                <ExternalLink
                  href="https://x.com/borisfyi"
                  target="_blank"
                  className="font-medium"
                >
                  @borisfyi
                </ExternalLink>
              </p>
            </>
          )}
        </Suspense>
      </div>
      <MapContainer cities={cities} className="h-[400px] w-full md:h-full" />
    </main>
  );
}

async function UserTable({ city }: { city: City }) {
  const users: DbUser[] = await getUsers(city);

  return (
    <div className="grid grid-cols-[min-content,max-content,1fr] gap-x-12 gap-y-1">
      {users.map((user) => {
        const clientUser = getClientUser(user);

        return (
          <Fragment key={clientUser.username}>
            <p>
              <ExternalLink
                href={
                  clientUser.atHnUrl ??
                  `https://news.ycombinator.com/user?id=${clientUser.username}`
                }
                className="font-medium"
              >
                {clientUser.username}
              </ExternalLink>
            </p>
            <div className="mt-0.5">
              {clientUser.socials ? (
                <Socials socials={clientUser.socials} />
              ) : null}
            </div>
            {clientUser.about ? (
              <GroupToggleItem>
                <div className="col-span-full my-1 text-sm text-gray-400">
                  {clientUser.about}
                </div>
              </GroupToggleItem>
            ) : null}
            <div className="col-span-full h-px bg-gray-300"></div>
          </Fragment>
        );
      })}
    </div>
  );
}

function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
