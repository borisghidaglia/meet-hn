import { notFound, permanentRedirect } from "next/navigation";
import { Fragment } from "react";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";

import { getCities } from "@/app/_actions/getCities";
import { getCity } from "@/app/_actions/getCity";
import { City, DbUser } from "@/app/_db/schema";
import { getRedirect } from "@/app/_db/Place";
import { getUsers } from "@/app/_db/User";
import { cityGeo, GeoPlace, nearby, NEARBY_KM } from "@/app/_lib/nearby";
import { getClientUser } from "@/app/_db/User.client";
import { GroupToggle, GroupToggleItem } from "@/components/GroupToggle";
import { MAP_PREVIEW_CITY_ATTR } from "@/app/_lib/mapView";
import { Socials } from "@/components/Socials";
import { Tag } from "@/components/Tags";
import { ExternalLink } from "@/components/ui/ExternalLink";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export async function generateStaticParams() {
  const cities: City[] = await getCities();

  return cities.map((city) => ({
    id: [city.id],
  }));
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id } = await params;
  if (id[0] === undefined) return notFound();

  const selectedCityId = decodeURIComponent(id[0]);
  const selectedCity = await getCity(selectedCityId);
  if (selectedCity === undefined) {
    // Merged or re-keyed page: old links (pasted in HN profiles) keep working.
    const to = await getRedirect(selectedCityId);
    if (to) permanentRedirect(`/city/${[encodeURIComponent(to), ...id.slice(1)].join("/")}`);
    return notFound();
  }

  // Read by the map preview (components/MapPreview.tsx) so it opens on this
  // city, as the map does.
  const geo = cityGeo(selectedCity);
  const previewCity =
    geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)
      ? { [MAP_PREVIEW_CITY_ATTR]: `${geo.lat},${geo.lon}` }
      : {};

  return (
    <div {...previewCity}>
      <p className="text-3xl">{getFlagEmoji(selectedCity.countryCode)}</p>
      <p>
        <span className="mr-2 text-xl font-semibold">
          {selectedCity.hackers}
        </span>
        {selectedCity.hackers > 1 ? "hackers" : "hacker"} in {selectedCity.name}
        {selectedCity.country ? `, ${selectedCity.country}` : null}
      </p>
      {selectedCity.communityLinks === undefined ? null : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <p className="font-semibold">Community Links</p>
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1">
                  <QuestionMarkCircledIcon className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                side="right"
                avoidCollisions={true}
                className="bg-[#fefef8] px-2 py-1.5"
              >
                <p className="text-sm">
                  Want to list your link here? Send an email to{" "}
                  <span className="font-medium">community@meet.hn</span>
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <ul className="list-inside">
            {selectedCity.communityLinks.map((cl) => (
              <li key={cl.link}>
                → <ExternalLink href={cl.link}>{cl.name}</ExternalLink>
              </li>
            ))}
          </ul>
        </>
      )}
      <GroupToggle>
        <UserTable city={selectedCity} />
      </GroupToggle>
      <NearbySection city={selectedCity} />
    </div>
  );
}

const MAX_NEARBY = 12;

async function NearbySection({ city }: { city: City }) {
  const self = cityGeo(city);
  if (self === null) return null;
  const places = (await getCities())
    .map(cityGeo)
    .filter((p): p is GeoPlace => p !== null);
  const { near, region, hackersNear } = nearby(self, places);
  if (near.length === 0 && region.length === 0) return null;

  const label = (p: GeoPlace) => (
    <Link href={`/city/${encodeURIComponent(p.id)}`} className="underline">
      {p.name || "Unnamed place"}
    </Link>
  );
  return (
    <section className="mt-8">
      {near.length > 0 ? (
        <>
          <p>
            <span className="mr-2 text-xl font-semibold">{hackersNear}</span>
            more {hackersNear > 1 ? "hackers" : "hacker"} within {NEARBY_KM} km
          </p>
          <ul className="mt-1 list-inside">
            {near.slice(0, MAX_NEARBY).map(({ place, km }) => (
              <li key={place.id}>
                → {label(place)}{" "}
                <span className="text-gray-500">
                  · {place.hackers} · {km < 1 ? "<1" : Math.round(km)} km
                </span>
              </li>
            ))}
          </ul>
          {near.length > MAX_NEARBY ? (
            <p className="text-gray-500">
              and {near.length - MAX_NEARBY} more places
            </p>
          ) : null}
        </>
      ) : null}
      {region.length > 0 ? (
        <>
          <p className="mt-4 font-semibold">Also in this region</p>
          <ul className="mt-1 list-inside">
            {region.slice(0, MAX_NEARBY).map((place) => (
              <li key={place.id}>
                → {label(place)}{" "}
                <span className="text-gray-500">· {place.hackers}</span>
              </li>
            ))}
          </ul>
          {region.length > MAX_NEARBY ? (
            <p className="text-gray-500">
              and {region.length - MAX_NEARBY} more places
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

async function UserTable({ city }: { city: City }) {
  const users: DbUser[] = await getUsers(city.id);

  return (
    <div className="grid grid-cols-[max-content,1fr] gap-x-12 gap-y-1">
      {users.map((user) => {
        const clientUser = getClientUser(user);
        const isClientUserRegisterToAtHn =
          clientUser.socials?.find((s) => s.name === "at.hn") !== undefined;

        return (
          <Fragment key={clientUser.username}>
            <p>
              <ExternalLink
                href={
                  isClientUserRegisterToAtHn
                    ? `https://${clientUser.username}.at.hn`
                    : `https://news.ycombinator.com/user?id=${clientUser.username}`
                }
                className="font-medium"
              >
                {clientUser.username}
              </ExternalLink>
            </p>
            <div className="mt-0.5">
              {clientUser.socials ? (
                <Socials
                  socials={clientUser.socials.filter((s) => s.name !== "at.hn")}
                />
              ) : null}
            </div>
            {clientUser.tags ? (
              <GroupToggleItem>
                <div className="col-span-full my-1 flex flex-wrap gap-1 text-sm text-gray-400">
                  {clientUser.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
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

function getFlagEmoji(countryCode?: string) {
  if (countryCode === undefined) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
