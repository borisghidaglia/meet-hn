import { describe, expect, it } from "vitest";

import { isValidUuidInHnUserAbout } from "@/app/_actions/addUser";
import {
  parseAtHnUrl,
  parseSocials,
  supportedSocials,
} from "@/components/Socials";

describe("parseHnAboutSection", () => {
  it("parses UUID from HN user about section", async () => {
    const validAbout = "meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c";
    const invalidAbout = "meet.hn-91db6831-e53e-42ea-b76e-c94a3f84888c";
    expect(
      await isValidUuidInHnUserAbout(
        validAbout,
        "meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c",
      ),
    ).toBe(true);
    expect(
      await isValidUuidInHnUserAbout(
        invalidAbout,
        "meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c",
      ),
    ).toBe(false);
  });

  it("parses all social profile urls from HN user about section", () => {
    const about = `
    https://x.com/borisfyi https://www.instagram.com/sirob.g/ Aut sirobg.at.hn laborum https://t.me/borisfyi cumque https://cal.com/peer animi perferendis 
    itaque, https://bsky.app/profile/boris.fyi expedita https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ beatae https://soundcloud.com/boris-ghidaglia exercitationem est pariatur eligendi amet? https://calendar.app.google/GSadqubSJfRERVLv8 Accusantium
    totam eaque https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq molestias https://www.reddit.com/user/sirobg/ maxime https://www.linkedin.com/in/boris-ghidaglia/ sint https://calendly.com/daedaliumx/better-call-ouss praesentium https://www.instagram.com/sirob.g/?
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
    https://x.com/borisfyi https://www.instagram.com/sirob.g/ Aut sirobg.at.hn laborum cumque animi perferendis 
    itaque, https://bsky.app/profile/boris.fyi expedita https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ beatae https://soundcloud.com/boris-ghidaglia exercitationem est pariatur eligendi amet? Accusantium
    totam eaque https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq molestias https://www.reddit.com/user/sirobg/ maxime https://www.linkedin.com/in/boris-ghidaglia/ sint praesentium https://www.instagram.com/sirob.g/?
    `;
    expect(parseAtHnUrl(about, "sirobg")).toBe("https://sirobg.at.hn");
  });
});
