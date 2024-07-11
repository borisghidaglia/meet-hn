import { SignUpForm } from "@/components/SignUpForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readFileSync } from "fs";
import dynamic from "next/dynamic";
import { User, City } from "@/app/_db/schema";
import { getUsers } from "./_db/User";
import { getCities } from "./_db/City";

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
  const hash = generateRandomHash();
  const cities: City[] = await getCities();
  const selectedCity = searchParams?.city
    ? cities.find((city) => city.id == searchParams.city)
    : null;

  return (
    <main className="grid grid-cols-[max-content,1fr] min-h-dvh">
      <div className="p-5 max-w-xl space-y-8">
        <h1 className="text-3xl font-bold">Meet HN</h1>
        <p>Please, set this hash in your account description: {hash}</p>
        <SignUpForm hash={hash} />
        {selectedCity ? (
          <>
            <p>
              {selectedCity.hackers}{" "}
              {selectedCity.hackers > 1 ? "hackers" : "hacker"} in{" "}
              {selectedCity.name}, {selectedCity.country}{" "}
              {getFlagEmoji(selectedCity.countryCode)}
            </p>
            <UserTable city={selectedCity} />
          </>
        ) : (
          <p>Click on a city to display the hackers living there</p>
        )}
      </div>
      <MapContainer key={cities.map((c) => c.id).join("-")} cities={cities} />
    </main>
  );
}

async function UserTable({ city }: { city: City }) {
  const users: User[] = await getUsers(city);

  return (
    <Table>
      <TableHeader className="text-[#99999a]">
        <TableRow className="border-none">
          <TableHead className="w-[100px]">Username</TableHead>
          <TableHead>City</TableHead>
          <TableHead>Country</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.values(users).map((user) => (
          <TableRow key={user.username} className="border-gray-300">
            <TableCell className="font-medium">{user.username}</TableCell>
            <TableCell>{city?.name}</TableCell>
            <TableCell>{city?.country}</TableCell>
            <TableCell className="text-xl py-0 text-right">
              {city?.countryCode ? getFlagEmoji(city.countryCode) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const generateRandomHash = (length = 16) => {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};
