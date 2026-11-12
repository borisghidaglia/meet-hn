import { revalidateTag } from "next/cache";

import { DIRECTORY_TAG } from "@/app/_db/City";

// POST {tags, now?}. By default the tags are marked stale: each page keeps
// being served from the cache and is rebuilt in the background on its next
// visit, so nobody waits for a render (most tags, like "cities", reach every
// page). With now: true they expire at once and the next visit of each page
// waits for fresh data: for a release whose old pages must not be shown even
// once.
export async function POST(request: Request) {
  const apiKey = request.headers.get("api-key");
  if (apiKey === null || apiKey !== process.env.REVALIDATE_API_KEY!)
    return new Response("Denied");

  const body = await request.json();
  const tags = body.tags as string[] | undefined;
  if (tags === undefined) return new Response("No tags provided");
  const now = body.now === true;

  for (const tag of tags) revalidateTag(tag, now ? { expire: 0 } : "max");
  // Read by sign-ups only, never by a page: always fresh.
  revalidateTag(DIRECTORY_TAG, { expire: 0 });

  return new Response(now ? "Done (expired)" : "Done (marked stale)");
}
