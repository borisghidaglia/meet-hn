import { describe, expect, it } from "vitest";

import { isValidUuidInHnUserAbout } from "@/app/_actions/addUser";
import {
  parseAtHnUrl,
  parseSocials,
  supportedSocials,
} from "@/components/Socials";

describe("parseHnAboutSection", () => {
  it("parses UUID from HN user about section", async () => {
    const about = `
    meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c
    `;
    expect(
      await isValidUuidInHnUserAbout(
        about,
        "meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c",
      ),
    ).toBe(true);
  });

  it("parses all social profile urls from HN user about section", () => {
    const about = `
    https://x.com/borisfyi https://www.instagram.com/sirob.g/ Aut sirobg.at.hn laborum cumque animi perferendis 
    itaque, https://bsky.app/profile/boris.fyi expedita https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ beatae https://soundcloud.com/boris-ghidaglia exercitationem est pariatur eligendi amet? Accusantium
    totam eaque https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq molestias https://www.reddit.com/user/sirobg/ maxime https://www.linkedin.com/in/boris-ghidaglia/ sint praesentium https://www.instagram.com/sirob.g/?
    `;
    const validParsedUrls = {
      bluesky: "https://bsky.app/profile/boris.fyi",
      instagram: "https://www.instagram.com/sirob.g/",
      linkedin: "https://www.linkedin.com/in/boris-ghidaglia/",
      reddit: "https://www.reddit.com/user/sirobg/",
      soundcloud: "https://soundcloud.com/boris-ghidaglia",
      spotify: "https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq",
      twitter: "https://x.com/borisfyi",
      youtubeMusic:
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
