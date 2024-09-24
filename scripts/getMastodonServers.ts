import { writeFileSync } from "fs";
// import fetchedMastodonServer from "../mastodonServer.json";

async function main() {
  const instances: { name?: string; users?: number }[] = await fetch(
    "https://instances.social/instances.json",
  ).then((res) => res.json());

  instances.sort((a, b) =>
    a.users !== undefined && b.users !== undefined ? b.users - a.users : 0,
  );

  const mastodonServers: string[] = [];
  for (const instance of instances) {
    if (!instance.name) {
      console.log(instance);
      continue;
    }
    mastodonServers.push(instance.name);
  }
  console.log({ fetched: mastodonServers.length });
  writeFileSync("./mastodonServer.json", JSON.stringify(mastodonServers));
}

// async function main() {
//   console.log(fetchedMastodonServer.length);
//   const x = new Set(fetchedMastodonServer);
//   console.log(x.size);
// }

main();
