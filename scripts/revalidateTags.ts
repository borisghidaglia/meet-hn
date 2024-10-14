import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const tags: string[] = [];

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
    }),
  });
  console.log(await res.text());
}

main();
