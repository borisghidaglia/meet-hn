import { describe, expect, it } from "vitest";

import {
  parseAtHnUrl,
  parseSocials,
  supportedSocials,
} from "@/components/Socials";

describe("parseHnAboutSection", () => {
  it("parses all social profile urls from HN user about section", () => {
    const about = `
    ### meet.hn/?city=fr-Toulouse
    Socials:
    - bsky.app/profile/boris.fyi 
    - cal.com/peer 
    - calendly.com/daedaliumx/better-call-ouss
    - calendar.app.google/GSadqubSJfRERVLv8
    - www.instagram.com/sirob.g/
    - www.linkedin.com/in/boris-ghidaglia/
    - www.reddit.com/user/sirobg/
    - soundcloud.com/boris-ghidaglia
    - open.spotify.com/user/21fck52nwq4xr65gtemvmslxq 
    - t.me/borisfyi
    - x.com/borisfyi 
    - music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ
    
    ---
    `;
    const validParsedUrls: {
      [k in (typeof supportedSocials)[number]["name"]]: string;
    } = {
      Bluesky: "https://bsky.app/profile/boris.fyi",
      "Cal.com": "https://cal.com/peer",
      Calendly: "https://calendly.com/daedaliumx/better-call-ouss",
      "Google Calendar": "https://calendar.app.google/GSadqubSJfRERVLv8",
      Instagram: "https://www.instagram.com/sirob.g/",
      LinkedIn: "https://www.linkedin.com/in/boris-ghidaglia/",
      Reddit: "https://www.reddit.com/user/sirobg/",
      SoundCloud: "https://soundcloud.com/boris-ghidaglia",
      Spotify: "https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq",
      Telegram: "https://t.me/borisfyi",
      "X/Twitter": "https://x.com/borisfyi",
      "YouTube Music":
        "https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ",
    };
    expect(parseSocials(about)).toStrictEqual(
      supportedSocials.map((social) => ({
        ...social,
        url: validParsedUrls[social.name as keyof typeof validParsedUrls],
      })),
    );
  });

  it("parses at.hn url from HN user about section", () => {
    const about = `
    ### meet.hn/?city=fr-Toulouse
    Socials:
    - sirobg.at.hn
    - bsky.app/profile/boris.fyi 
    - cal.com/peer 
    - calendly.com/daedaliumx/better-call-ouss
    - calendar.app.google/GSadqubSJfRERVLv8
    - www.instagram.com/sirob.g/
    - www.linkedin.com/in/boris-ghidaglia/
    - www.reddit.com/user/sirobg/
    - soundcloud.com/boris-ghidaglia
    - open.spotify.com/user/21fck52nwq4xr65gtemvmslxq 
    - t.me/borisfyi
    - x.com/borisfyi 
    - music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ
    
    ---
    `;
    expect(parseAtHnUrl(about, "sirobg")).toBe("https://sirobg.at.hn");
  });
});
