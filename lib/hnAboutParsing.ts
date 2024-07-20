import { defaultSocialLinks } from "@/app/_db/schema";

export function isValidHashInHnUserAbout(about: string, hash: string) {
  const regex =
    /meet\.hn-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = about.match(regex);
  const matchedHash = match?.[0];
  return matchedHash === hash;
}

export function parseSocialLinks(about: string) {
  // Define the patterns
  const patterns = {
    bluesky: /https:\/\/bsky\.app\/profile\/[\w.:-]+\/?/,
    instagram: /https:\/\/(?:www\.)?instagram\.com\/[\w.-]+\/?/,
    linkedin: /https:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/,
    soundcloud: /https:\/\/(www\.)?soundcloud\.com\/[\w-]+\/?/,
    twitter: /https:\/\/(www\.)?(x\.com|twitter\.com)\/[\w-]+\/?/,
  };

  // Whitelist of allowed domains
  const allowedDomains = [
    "x.com",
    "www.x.com",
    "twitter.com",
    "www.twitter.com",
    "bsky.app",
    "www.linkedin.com",
    "linkedin.com",
    "instagram.com",
    "www.instagram.com",
    "soundcloud.com",
    "www.soundcloud.com",
  ];

  const socialLinks = { ...defaultSocialLinks };

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
