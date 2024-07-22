import { defaultSocialLinks } from "@/app/_db/schema";
import {
  isValidUuidInHnUserAbout,
  parseSocialLinks,
} from "@/lib/hnAboutParsing";
import { describe, expect, it } from "vitest";

describe("parseHnAboutSection", () => {
  it("parses UUID from HN user about section", () => {
    const about = `
    meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c
    `;
    expect(
      isValidUuidInHnUserAbout(
        about,
        "meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c",
      ),
    ).toBe(true);
  });

  it("parses x profile url from HN user about section", () => {
    const about = `
    https://x.com/borisfyi
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      twitter: "https://x.com/borisfyi",
    });
  });

  it("parses twitter profile url from HN user about section", () => {
    const about = `
    https://twitter.com/borisfyi
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      twitter: "https://twitter.com/borisfyi",
    });
  });

  it("parses bluesky domain profile url from HN user about section", () => {
    const about = `
    https://bsky.app/profile/boris-kk.fyi
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      bluesky: "https://bsky.app/profile/boris-kk.fyi",
    });
  });

  it("parses bluesky weird @danabra.mov profile url from HN user about section", () => {
    const about = `
    https://bsky.app/profile/did:plc:fpruhuo22xkm5o7ttr2ktxdo
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      bluesky: "https://bsky.app/profile/did:plc:fpruhuo22xkm5o7ttr2ktxdo",
    });
  });

  it("parses bluesky classic profile url from HN user about section", () => {
    const about = `
    https://bsky.app/profile/sachagreif.bsky.social
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      bluesky: "https://bsky.app/profile/sachagreif.bsky.social",
    });
  });

  it("parses linkedin profile url from HN user about section", () => {
    const about = `
    https://www.linkedin.com/in/boris-ghidaglia/
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      linkedin: "https://www.linkedin.com/in/boris-ghidaglia/",
    });
  });

  it("parses instagram profile url from HN user about section", () => {
    const about = `
    https://www.instagram.com/sirob.g/
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      instagram: "https://www.instagram.com/sirob.g/",
    });
  });

  it("parses soundcloud profile url from HN user about section", () => {
    const about = `
    https://soundcloud.com/boris-ghidaglia
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      soundcloud: "https://soundcloud.com/boris-ghidaglia",
    });
  });

  it("parses spotify profile url from HN user about section", () => {
    const about = `
    https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      spotify: "https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq",
    });
  });

  it("parses YouTube Music profile url from HN user about section", () => {
    const about = `
    https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      youtubeMusic:
        "https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ",
    });
  });

  it("parses Reddit profile url from HN user about section", () => {
    const about = `
    https://www.reddit.com/user/sirobg/
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      reddit: "https://www.reddit.com/user/sirobg/",
    });
  });

  it("parses all social profile urls from HN user about section", () => {
    const about = `
    https://x.com/borisfyi https://www.instagram.com/sirob.g/ Aut laborum cumque animi perferendis 
    itaque, https://bsky.app/profile/boris.fyi expedita https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ beatae https://soundcloud.com/boris-ghidaglia exercitationem est pariatur eligendi amet? Accusantium
    totam eaque https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq molestias https://www.reddit.com/user/sirobg/ maxime https://www.linkedin.com/in/boris-ghidaglia/ sint praesentium https://www.instagram.com/sirob.g/?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      bluesky: "https://bsky.app/profile/boris.fyi",
      instagram: "https://www.instagram.com/sirob.g/",
      linkedin: "https://www.linkedin.com/in/boris-ghidaglia/",
      reddit: "https://www.reddit.com/user/sirobg/",
      soundcloud: "https://soundcloud.com/boris-ghidaglia",
      spotify: "https://open.spotify.com/user/21fck52nwq4xr65gtemvmslxq",
      twitter: "https://x.com/borisfyi",
      youtubeMusic:
        "https://music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQ",
    });
  });
});
