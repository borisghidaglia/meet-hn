import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

// Usage: npm run script scripts/revalidateTags.ts -- [--now] cities city redirects users
// Posts to https://meet.hn/revalidate (localhost:3000 when NODE_ENV=development).
// Without --now, pages are served as cached once more while they rebuild in
// the background; with --now, the next visit of every page waits for a render.
const args = process.argv.slice(2);
const now = args.includes("--now");
const tags: string[] = args.filter((a) => a !== "--now");
if (tags.length === 0) throw new Error("pass the tags to revalidate as arguments");

async function main() {
  const host =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://meet.hn";
  const res = await fetch(`${host}/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.REVALIDATE_API_KEY!,
      "x-vercel-protection-bypass":
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
    },
    body: JSON.stringify({
      tags: tags.map((tag) => encodeURIComponent(tag)),
      now,
    }),
  });
  console.log(await res.text());
}

main();
