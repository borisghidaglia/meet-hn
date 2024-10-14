import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const apiKey = request.headers.get("api-key");
  if (apiKey === null || apiKey !== process.env.REVALIDATE_API_KEY!)
    return new Response("Denied");

  const tags = (await request.json()).tags as string[] | undefined;
  if (tags === undefined) return new Response("No tags provided");

  for (const tag of tags) {
    revalidateTag(tag);
  }

  return new Response("Done");
}
