import { defaultSocialLinks, UserSocials } from "@/app/_db/schema";

export function isValidUuidInHnUserAbout(about: string, uuid: string) {
  const regex =
    /meet\.hn-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = about.match(regex);
  const matchedUuid = match?.[0];
  return matchedUuid === uuid;
}

export function parseSocialLinks(about: string) {
  // Define the patterns
  const patterns = {
    bluesky: /https:\/\/bsky\.app\/profile\/[\w.:-]+\/?/,
    instagram: /https:\/\/(?:www\.)?instagram\.com\/[\w.-]+\/?/,
    linkedin: /https:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/,
    reddit: /https:\/\/(?:www\.)?reddit\.com\/user\/[\w-]+\/?/,
    soundcloud: /https:\/\/(www\.)?soundcloud\.com\/[\w-]+\/?/,
    spotify: /https:\/\/open\.spotify\.com\/user\/[\w-]+\/?/,
    twitter: /https:\/\/(www\.)?(x\.com|twitter\.com)\/[\w-]+\/?/,
    youtubeMusic: /https:\/\/music\.youtube\.com\/channel\/[\w-]+\/?/,
  };

  // Whitelist of allowed domains
  const allowedDomains = [
    "bsky.app",
    "instagram.com",
    "www.instagram.com",
    "linkedin.com",
    "www.linkedin.com",
    "music.youtube.com",
    "open.spotify.com",
    "reddit.com",
    "www.reddit.com",
    "soundcloud.com",
    "www.soundcloud.com",
    "twitter.com",
    "www.twitter.com",
    "x.com",
    "www.x.com",
  ];

  const socialLinks: UserSocials = { ...defaultSocialLinks };

  for (const [platform, pattern] of Object.entries(patterns)) {
    const matchedUrl = about.match(pattern)?.[0];

    if (!matchedUrl) continue;

    try {
      // Try parsing the matched URL
      const parsedUrl = new URL(matchedUrl);

      // Check if the domain is in our whitelist
      if (!allowedDomains.includes(parsedUrl.hostname)) continue;

      // Check against length limits
      if (parsedUrl.href.length > 250) continue;

      // Check if it passes character whitelist
      if (!/^[a-zA-Z0-9:\/._-]+$/.test(parsedUrl.href)) continue;

      socialLinks[platform as keyof typeof patterns] = matchedUrl;
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

  return socialLinks;
}
