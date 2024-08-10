import { Fragment } from "react";

import { getCities } from "@/app/_db/City";
import { City, DbUser } from "@/app/_db/schema";
import { getClientUser, getUsers } from "@/app/_db/User";
import { GroupToggle, GroupToggleItem } from "@/components/GroupToggle";
import { SignUpForm } from "@/components/SignUpForm";
import { Socials } from "@/components/Socials";
import { Tag } from "@/components/Tags";
import { ExternalLink } from "@/components/ui/ExternalLink";

export default async function Home({
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

  return selectedCity ? (
    <div>
      <p className="text-3xl">{getFlagEmoji(selectedCity.countryCode)}</p>
      <p>
        <span className="mr-2 text-xl font-semibold">
          {selectedCity.hackers}
        </span>
        {selectedCity.hackers > 1 ? "hackers" : "hacker"} in {selectedCity.name}
        , {selectedCity.country}{" "}
      </p>
      <GroupToggle>
        <UserTable city={selectedCity} />
      </GroupToggle>
    </div>
  ) : (
    <>
      <SignUpForm />
      <p>
        If you do meet in real life and want to share a pic on Twitter, tag the{" "}
        <ExternalLink href="https://x.com/meet_hn" className="font-medium">
          @meet_hn
        </ExternalLink>{" "}
        account and I&apos;ll retweet you.
      </p>
      <p>
        To give some feedback or remove your profile from meet.hn, drop me a DM
        on Twitter{" "}
        <ExternalLink
          href="https://x.com/borisfyi"
          target="_blank"
          className="font-medium"
        >
          @borisfyi
        </ExternalLink>
      </p>
    </>
  );
}

async function UserTable({ city }: { city: City }) {
  const users: DbUser[] = await getUsers(city);

  return (
    <div className="grid grid-cols-[max-content,max-content,1fr] gap-x-12 gap-y-1">
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
            {clientUser.tags ? (
              <GroupToggleItem>
                <div className="col-span-full my-1 flex gap-1 text-sm text-gray-400">
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

function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
