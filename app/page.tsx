import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readFileSync } from "fs";
import { User } from "./_actions/addUser";
import { SignUpForm } from "@/components/SignUpForm";

export default function Home() {
  const users: Record<string, User> = JSON.parse(
    readFileSync(process.cwd() + "/app/data.json", "utf8")
  );
  const hash = generateRandomHash();

  return (
    <main className="p-5 max-w-xl m-auto space-y-8">
      <h1 className="text-3xl font-bold">Meet HN</h1>
      <p>Please, set this hash in your account description: {hash}</p>
      <SignUpForm hash={hash} />
      {Object.keys(users).length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Username</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(users).map((user) => (
              <TableRow>
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
