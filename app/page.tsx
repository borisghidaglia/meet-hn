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
import { User } from "./_actions/addUser";
import { City } from "@/components/MapContainer";
const MapContainer = dynamic(() => import("@/components/MapContainer"), {
  ssr: false,
});

export default function Home() {
  const users: Record<string, User> = JSON.parse(
    readFileSync(process.cwd() + "/app/data.json", "utf8")
  );
  const hash = generateRandomHash();

  const cities: Record<string, City> = {};
  for (const user of Object.values(users)) {
    const fullCityName = `${user.city}, ${user.countryCode}`;
    if (!(fullCityName in cities)) {
      cities[fullCityName] = {
        name: user.city,
        lat: user.lat,
        lon: user.lon,
        community: 0,
      };
    }
    cities[fullCityName] = {
      ...cities[fullCityName],
      community: cities[fullCityName].community + 1,
    };
  }

  return (
    <main className="grid grid-cols-[max-content,1fr] min-h-dvh">
      <div className="p-5 max-w-xl space-y-8">
        <h1 className="text-3xl font-bold">Meet HN</h1>
        <p>Please, set this hash in your account description: {hash}</p>
        <SignUpForm hash={hash} />
        {Object.keys(users).length > 0 ? (
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
                  <TableCell>{user.city}</TableCell>
                  <TableCell>{user.country}</TableCell>
                  <TableCell className="text-xl py-0 text-right">
                    {getFlagEmoji(user.countryCode)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
      <MapContainer cities={Object.values(cities)} />
    </main>
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
