import { CityWithoutMetadata, UserWithoutMetadata } from "@/app/_db/schema";
import { getClientUser } from "@/app/_db/User";

export default async function notifyTelegramChannel(
  user: UserWithoutMetadata,
  city: CityWithoutMetadata,
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const userClient = getClientUser({ ...user, createdAt: 0, updatedAt: 0 });

  // https://core.telegram.org/bots/api#markdownv2-style
  const escapteCharsForTelegramAPI = (input: string) => {
    const specialChars = /[_*\[\]()~`>#+=\-|{}\.!]/g;
    return input.replace(specialChars, "\\$&");
  };

  const message = [
    `User: [${user.username}](https://news.ycombinator.com/user?id=${user.username})`,
    `City: [${city.name}, ${city.country}](https://meet.hn/?city=${city.id})`,
    userClient.socials ? "Socials:" : undefined,
    ...Object.values(userClient.socials ?? {})
      .map((s) => `- ${s.url}`)
      .map(escapteCharsForTelegramAPI),
    userClient.tags ? "Interests:" : undefined,
    userClient.tags?.length && userClient.tags?.length > 0
      ? userClient.tags.map(escapteCharsForTelegramAPI).join(", ")
      : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "MarkdownV2",
    }),
  });

  if (!response.ok) {
    response.json().then(console.log);
    throw new Error("Failed to send Telegram message");
  }

  return await response.json();
}
