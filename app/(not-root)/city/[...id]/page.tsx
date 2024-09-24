import { notFound } from "next/navigation";
import { Fragment } from "react";

import { getCities } from "@/app/_actions/getCities";
import { getCity } from "@/app/_actions/getCity";
import { City, DbUser } from "@/app/_db/schema";
import { getUsers } from "@/app/_db/User";
import { getClientUser } from "@/app/_db/User.client";
import { GroupToggle, GroupToggleItem } from "@/components/GroupToggle";
import { Socials } from "@/components/Socials";
import { Tag } from "@/components/Tags";
import { ExternalLink } from "@/components/ui/ExternalLink";

export async function generateStaticParams() {
  const cities: City[] = await getCities();

  return cities.map((city) => ({
    id: [city.id],
  }));
}

export default async function CityPage({
  params: { id },
}: {
  params: { id: string[] };
}) {
  if (id[0] === undefined) return notFound();

  const selectedCityId = decodeURIComponent(id[0]);
  const selectedCity = await getCity(selectedCityId);
  if (selectedCity === undefined) return notFound();

  return (
    <div>
      <p className="text-3xl">{getFlagEmoji(selectedCity.countryCode)}</p>
      <p>
        <span className="mr-2 text-xl font-semibold">
          {selectedCity.hackers}
        </span>
        {selectedCity.hackers > 1 ? "hackers" : "hacker"} in {selectedCity.name}
        {selectedCity.country ? `, ${selectedCity.country}` : null}
      </p>
      <GroupToggle>
        <UserTable city={selectedCity} />
      </GroupToggle>
    </div>
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
