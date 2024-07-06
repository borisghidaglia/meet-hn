import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addUser, User } from "./_actions/addUser";
import { readFileSync } from "fs";
import {
  Table,
  TableCaption,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

export default function Home() {
  const users: Record<string, User> = JSON.parse(
    readFileSync(process.cwd() + "/app/data.json", "utf8")
  );
  return (
    <main className="p-5 max-w-xl m-auto space-y-8">
      <h1 className="text-3xl font-bold">Meet HN</h1>
      <form action={addUser} className="max-w-xl flex flex-col gap-2">
        <Input name="username" type="text" placeholder="HN username" />
        <Input name="location" type="text" placeholder="City, Country" />
        <Button type="submit" className="self-end">
          Register
        </Button>
      </form>
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
