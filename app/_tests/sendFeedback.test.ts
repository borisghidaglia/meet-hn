import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const checkBotId = vi.fn();
vi.mock("botid/server", () => ({ checkBotId: () => checkBotId() }));
const sendMessage = vi.fn();
vi.mock("@/app/_lib/telegram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/_lib/telegram")>()),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
}));

import { sendFeedback } from "@/app/_actions/sendFeedback";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("sendFeedback", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_FEEDBACK_CHAT_ID", "chat");
    checkBotId.mockReset().mockResolvedValue({ isBot: false });
    sendMessage.mockReset().mockResolvedValue({ ok: true });
  });

  it("sends a human's feedback to Telegram", async () => {
    const state = await sendFeedback(
      undefined,
      form({ feedback: "Nice site!", website: "" }),
    );
    expect(state?.success).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith("chat", "Nice site\\!");
  });

  it("drops a filled honeypot without telling the bot", async () => {
    const state = await sendFeedback(
      undefined,
      form({ feedback: "spam", website: "http://x" }),
    );
    expect(state?.success).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("blocks requests BotID flags as bots", async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    const state = await sendFeedback(undefined, form({ feedback: "spam" }));
    expect(state?.success).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rejects empty and over-long feedback", async () => {
    expect(
      (await sendFeedback(undefined, form({ feedback: "  " })))?.success,
    ).toBe(false);
    expect(
      (await sendFeedback(undefined, form({ feedback: "a".repeat(3001) })))
        ?.success,
    ).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("reports a Telegram failure instead of claiming success", async () => {
    sendMessage.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await sendFeedback(undefined, form({ feedback: "hello" }));
    expect(state?.success).toBe(false);
  });
});
