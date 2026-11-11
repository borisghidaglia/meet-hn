// Place-name comparison shared by the sign-up resolver (app) and the
// migration pipeline (scripts/osmMatch.ts), so both apply the same rule.

export const normName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// ---------- the same city under another name ----------
// "London" vs "Greater London", "Old Toronto" vs "Toronto", "Capital City of
// Prague" vs "Prague", "Da Nang" vs "Đà Nẵng", "St. Louis" vs "Saint Louis".
// Only a few generic administrative wrappers and spelling are ignored (not a
// per-place list); anything else in the name (Kingston upon Thames, New
// London, Queens Chapel…) keeps it distinct.
const TRANSLIT: Record<string, string> = { đ: "d", ł: "l", ø: "o", æ: "ae", œ: "oe", ß: "ss", ı: "i", þ: "th" };
// No bare "city of ": in the UK and Australia it names a part of the city
// (City of London is the Square Mile, City of Sydney the centre).
const CITY_PREFIX = /^(?:the |old |greater |capital city of |metropolitan city of |municipality of |ciudad de |ville de )+/;
const CITY_SUFFIX = /(?: city| metropolitan area| metropolitan municipality| metropolitan city| shire council| shire| municipality| city council)+$/;
// Spelling only (transliteration, accents, Saint/St), no wrapper removed.
const spelling = (s: string) =>
  normName(s.toLowerCase().replace(/[đłøæœßıþ]/g, (ch) => TRANSLIT[ch] ?? ch)).replace(/\b(?:saint|sankt|st)\b/g, "st");
export const cityCore = (s: string) => {
  let n = spelling(s);
  for (let prev = ""; prev !== n; ) {
    prev = n;
    n = n.replace(CITY_PREFIX, "").replace(CITY_SUFFIX, "").trim();
  }
  return n;
};
// One of the two must BE the plain name (London / Greater London): two
// different wrappers around one word (Greater X / X City) prove nothing.
export const sameCityName = (a: string, b: string) => {
  const x = cityCore(a);
  return x.length > 0 && x === cityCore(b) && (spelling(a) === x || spelling(b) === x);
};
