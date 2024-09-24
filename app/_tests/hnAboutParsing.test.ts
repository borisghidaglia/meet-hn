import { describe, expect, it } from "vitest";

import { parseSocials, Social } from "@/components/Socials";

describe("parseHnAboutSection", () => {
  it("parses all social profile urls from HN user about section", () => {
    const about = `
    meet.hn/city/fr-Toulouse
    Socials:
    - sirobg.at.hn
    - bsky.app/profile/boris.fyi 
    - cal.com/peer 
    - calendly.com/daedaliumx/better-call-ouss
    - discord:sirobg#1499
    - hi@meet.hn
    - github.com/borisghidaglia
    - gitlab.com/bghidaglia_joko
    - calendar.app.google/GSadqubSJfRERVLv8
    - scholar.google.com/citations?user=WLN3QrAAAAAJ
    - www.instagram.com/sirob.g
    - www.linkedin.com/in/boris-ghidaglia
    - mastodon.social/@borisfyi
    - www.reddit.com/user/sirobg
    - soundcloud.com/boris-ghidaglia
    - open.spotify.com/user/21fck52nwq4xr65gtemvmslxq 
    - t.me/borisfyi
    - 0m.studio
    - x.com/borisfyi 
    - youtube.com/@borisghidaglia
    - music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ
    ---
    `;
    const validParsedValues: {
      [key in Social["name"]]: string;
    } = {
      "at.hn": "https://sirobg.at.hn/",
      Bluesky: "https://bsky.app/profile/boris.fyi",
      "Cal.com": "https://cal.com/peer",
      Calendly: "https://calendly.com/daedaliumx/better-call-ouss",
      Discord: "discord:sirobg#1499",
      Email: "hi@meet.hn",
      Github: "https://github.com/borisghidaglia",
      Gitlab: "https://gitlab.com/bghidaglia_joko",
      "Google Calendar": "https://calendar.app.google/GSadqubSJfRERVLv8",
      "Google Scholar":
        "https://scholar.google.com/citations?user=WLN3QrAAAAAJ",
      Instagram: "https://www.instagram.com/sirob.g",
      LinkedIn: "https://www.linkedin.com/in/boris-ghidaglia",
      Mastodon: "https://mastodon.social/@borisfyi",
      Reddit: "https://www.reddit.com/user/sirobg",
      SoundCloud: "https://soundcloud.com/boris-ghidaglia",
      Spotify: "https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq",
      Telegram: "https://t.me/borisfyi",
      Website: "https://0m.studio/",
      "X/Twitter": "https://x.com/borisfyi",
      YouTube: "https://youtube.com/@borisghidaglia",
      "YouTube Music":
        "https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ",
    };
    expect(
      parseSocials(about)?.map((e) => e.url?.href ?? e.value),
    ).toStrictEqual(Object.values(validParsedValues));
  });
});
