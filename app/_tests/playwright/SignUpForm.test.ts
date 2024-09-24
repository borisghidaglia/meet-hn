import { test, expect } from "@playwright/test";

const socialNamesToValues = {
  "Google Calendar": "GSadqubSJfRERVLv8",
  LinkedIn: "boris-ghidaglia",
  "X/Twitter": "borisfyi",
  Telegram: "borisfyi",
  Github: "borisghidaglia",
  "at.hn": "sirobg.at.hn",
  Bluesky: "boris.fyi",
  "Cal.com": "peer",
  Calendly: "daedaliumx/better-call-ouss",
  Email: "hi@meet.hn",
  Gitlab: "bghidaglia_joko",
  "Google Scholar": "WLN3QrAAAAAJ",
  Instagram: "sirob.g",
  Reddit: "sirobg",
  Spotify: "21fck52nwq4xr65gtemvmslxq",
  SoundCloud: "boris-ghidaglia",
  YouTube: "@borisghidaglia",
  "YouTube Music": "UC_kEi4T_421er6ovq64GdsQ",
  Discord: "sirobg#1499",
  Mastodon: "mastodon.soc/@borisfyi",
  Website: "0m.studio",
} as const;

test("Full signup", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByPlaceholder("HN username").click();
  await page.getByPlaceholder("HN username").fill("sirobg");

  await page.getByPlaceholder("Search location").click();
  await page.getByPlaceholder("Search location").fill("Toulouse");
  await page.getByTestId("city-selector-res-0").click();

  await page.getByText("Add Socials...").click();
  for (const name of Object.keys(socialNamesToValues)) {
    await page.getByTestId(name).click();
  }

  await page.getByText("Add Tags...").click();
  await page.getByRole("option", { name: "AI/ML" }).click();
  await page.getByRole("option", { name: "AI/ML" }).click();
  await page.getByPlaceholder("Search tags...").click();
  await page.getByPlaceholder("Search tags...").fill("fitne");
  await page.getByPlaceholder("Search tags...").press("Enter");
  await page.getByPlaceholder("Search tags...").fill("");
  await page.getByPlaceholder("Search tags...").fill("free");
  await page.getByPlaceholder("Search tags...").press("Enter");
  await page.getByPlaceholder("Search tags...").fill("");
  await page.getByPlaceholder("Search tags...").fill("Start");
  await page.getByPlaceholder("Search tags...").press("Enter");
  await page.getByPlaceholder("Search tags...").fill("");
  await page.getByPlaceholder("Search tags...").fill("Web D");
  await page.getByPlaceholder("Search tags...").press("Enter");

  for (const [name, value] of Object.entries(socialNamesToValues)) {
    if (name === "at.hn") continue;
    await page.locator(`input[name="${name}"]`).click();
    await page.locator(`input[name="${name}"]`).fill(value);
  }

  const page1Promise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open my HN account" }).click();
  const page1 = await page1Promise;
  expect(page1.url()).toBe("https://news.ycombinator.com/user?id=sirobg");
  console.log(await page.getByTestId("generated-text").textContent());
  expect(await page.getByTestId("generated-text").textContent()).toBe(
    `meet.hn/city/43.6044622,1.4442469/ToulouseSocials:- sirobg.at.hn- bsky.app/profile/boris.fyi- cal.com/peer- calendly.com/daedaliumx/better-call-ouss- discord:sirobg#1499- hi@meet.hn- github.com/borisghidaglia- gitlab.com/bghidaglia_joko- calendar.app.google/GSadqubSJfRERVLv8- scholar.google.com/citations?user=WLN3QrAAAAAJ- instagram.com/sirob.g- linkedin.com/in/boris-ghidaglia- mastodon:mastodon.soc/@borisfyi- reddit.com/user/sirobg- soundcloud.com/boris-ghidaglia- open.spotify.com/user/21fck52nwq4xr65gtemvmslxq- t.me/borisfyi- 0m.studio- x.com/borisfyi- youtube.com/@borisghidaglia- music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQInterests:Fitness, Freelancing, Startups, Web Development---\n`,
  );
});

test("Full signup using autofill", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByPlaceholder("HN username").click();
  await page.getByPlaceholder("HN username").fill("sirobg");
  await page.getByRole("button", { name: "👋" }).click();
  await page.waitForTimeout(300);

  expect(await page.getByTestId("generated-text").textContent()).toBe(
    `meet.hn/city/43.6044622,1.4442469/ToulouseSocials:- sirobg.at.hn- bsky.app/profile/boris.fyi- cal.com/peer- calendly.com/daedaliumx/better-call-ouss- discord:sirobg#1499- hi@meet.hn- github.com/borisghidaglia- gitlab.com/bghidaglia_joko- calendar.app.google/GSadqubSJfRERVLv8- scholar.google.com/citations?user=WLN3QrAAAAAJ- instagram.com/sirob.g- linkedin.com/in/boris-ghidaglia- mastodon:mastodon.soc/@borisfyi- reddit.com/user/sirobg- soundcloud.com/boris-ghidaglia- open.spotify.com/user/21fck52nwq4xr65gtemvmslxq- t.me/borisfyi- 0m.studio- x.com/borisfyi- youtube.com/@borisghidaglia- music.youtube.com/channel/UC_kEi4T_421er6ovq64GdsQInterests:Fitness, Freelancing, Startups, Web Development---\n`,
  );
});

test("Empty social doesn't lead to empty list element in generated text", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/");
  await page.getByPlaceholder("HN username").click();
  await page.getByPlaceholder("HN username").fill("sirobg");
  await page.getByPlaceholder("Search location").click();
  await page
    .getByPlaceholder("Search location")
    .fill("São Paulo, Região Imediata de São Paulo");
  await page.getByTestId("city-selector-res-0").click();

  await page.getByText("Add Socials...").click();
  await page.getByRole("option", { name: "Google Calendar" }).click();

  expect(await page.getByTestId("generated-text").textContent()).toBe(
    `meet.hn/city/-23.5506507,-46.6333824/São-Paulo`,
  );
});

test("Autofilling doesn't keep old social input values", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByPlaceholder("HN username").click();
  await page.getByPlaceholder("HN username").fill("sirobg");
  await page.getByRole("button", { name: "👋" }).click();
  await page.waitForTimeout(300);
  expect(await page.getByPlaceholder("Search location").inputValue()).toBe(
    "Toulouse",
  );
  await page.getByPlaceholder("HN username").click();
  await page.getByPlaceholder("HN username").fill("uryga");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "👋" }).click();
  await page.waitForTimeout(300);
  expect(await page.getByPlaceholder("Search location").inputValue()).toBe(
    "Berlin",
  );
  expect(await page.locator('input[name="X\\/Twitter"]').inputValue()).toBe(
    "lubieowoce",
  );
  expect(await page.locator('input[name="Github"]').inputValue()).toBe(
    "lubieowoce",
  );
});

test("Focus not lost when typing in social input", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByPlaceholder("HN username").click();
  await page.getByPlaceholder("HN username").fill("sirobg");
  await page.getByPlaceholder("Search location").click();
  await page.getByPlaceholder("Search location").fill("NYC");
  await page.getByTestId("city-selector-res-0").click();

  await page.getByText("Add Socials...").click();
  await page.getByRole("option", { name: "Google Calendar" }).click();

  // We do this one sequentially to make sure SocialSelector.Input doesn't lose focus when the user types
  await page
    .locator('input[name="Google Calendar"]')
    .pressSequentially("GSadqubSJfRERVLv8");

  expect(await page.getByTestId("generated-text").textContent()).toBe(
    `meet.hn/city/40.7127281,-74.0060152/New-YorkSocials:- calendar.app.google/GSadqubSJfRERVLv8---\n`,
  );
});
