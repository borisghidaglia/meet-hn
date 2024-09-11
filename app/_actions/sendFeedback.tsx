"use server";
import "server-only";

import { escapteCharsForTelegramAPI, sendMessage } from "@/app/_lib/telegram";

export const sendFeedback = async (prevState: unknown, formData: FormData) => {
  const chatId = process.env.TELEGRAM_FEEDBACK_CHAT_ID!;
  const { feedback } = Object.fromEntries(formData);

  if (typeof feedback !== "string" || feedback === "")
    return {
      success: false,
      message:
        "Can't send an empty feedback. If your feedback is just no feedback, send a ❤️",
    };

  sendMessage(chatId, escapteCharsForTelegramAPI(feedback));
  return { success: true, message: "Thanks a lot for sharing 🙏" };
};
