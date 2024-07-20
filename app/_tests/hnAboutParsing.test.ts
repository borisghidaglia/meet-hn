import { defaultSocialLinks } from "@/app/_db/schema";
import {
  isValidHashInHnUserAbout,
  parseSocialLinks,
} from "@/lib/hnAboutParsing";
import { describe, expect, it } from "vitest";

describe("parseHnAboutSection", () => {
  it("parses hash from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(
      isValidHashInHnUserAbout(
        about,
        "meet.hn-81db6831-e53e-42ea-b76e-c94a3f84888c",
      ),
    ).toBe(true);
  });

  it("parses x profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://x.com/borisfyi Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      twitter: "https://x.com/borisfyi",
    });
  });

  it("parses twitter profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://twitter.com/borisfyi Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      twitter: "https://twitter.com/borisfyi",
    });
  });

  it("parses bluesky domain profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://bsky.app/profile/boris-kk.fyi Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      bluesky: "https://bsky.app/profile/boris-kk.fyi",
    });
  });

  it("parses bluesky weird @danabra.mov profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://bsky.app/profile/did:plc:fpruhuo22xkm5o7ttr2ktxdo Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      bluesky: "https://bsky.app/profile/did:plc:fpruhuo22xkm5o7ttr2ktxdo",
    });
  });

  it("parses bluesky classic profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://bsky.app/profile/sachagreif.bsky.social Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      bluesky: "https://bsky.app/profile/sachagreif.bsky.social",
    });
  });

  it("parses linkedin profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://www.linkedin.com/in/boris-ghidaglia/ Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      linkedin: "https://www.linkedin.com/in/boris-ghidaglia/",
    });
  });

  it("parses instagram profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://www.instagram.com/sirob.g/ Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      instagram: "https://www.instagram.com/sirob.g/",
    });
  });

  it("parses soundcloud profile url from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit. https://soundcloud.com/boris-ghidaglia Aut laborum cumque animi perferendis 
    itaque, expedita beatae exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime sint praesentium necessitatibus quae?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      ...defaultSocialLinks,
      soundcloud: "https://soundcloud.com/boris-ghidaglia",
    });
  });

  it("parses all social profile urls from HN user about section", () => {
    const about = `
    Lorem ipsum dolor sit, amet consectetur
    adipisicing elit.https://x.com/borisfyi https://www.instagram.com/sirob.g/ Aut laborum cumque animi perferendis 
    itaque, https://bsky.app/profile/boris.fyi expedita beatae https://soundcloud.com/boris-ghidaglia exercitationem est pariatur eligendi amet? Accusantium
    totam eaque molestias maxime https://www.linkedin.com/in/boris-ghidaglia/ sint praesentium https://www.instagram.com/sirob.g/?
    `;
    expect(parseSocialLinks(about)).toStrictEqual({
      bluesky: "https://bsky.app/profile/boris.fyi",
      instagram: "https://www.instagram.com/sirob.g/",
      linkedin: "https://www.linkedin.com/in/boris-ghidaglia/",
      soundcloud: "https://soundcloud.com/boris-ghidaglia",
      twitter: "https://x.com/borisfyi",
    });
  });
});
