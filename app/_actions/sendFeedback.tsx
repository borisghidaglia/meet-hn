"use server";
import "server-only";

import { checkBotId } from "botid/server";

import { HONEYPOT_FIELD } from "@/app/_lib/feedback";
import { escapeCharsForTelegramAPI, sendMessage } from "@/app/_lib/telegram";

// Telegram rejects messages over 4096 characters; escaping adds some.
const MAX_FEEDBACK_LENGTH = 3000;

type FeedbackState = { success: boolean; message: string } | undefined;

export const sendFeedback = async (
  prevState: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> => {
  const chatId = process.env.TELEGRAM_FEEDBACK_CHAT_ID!;
  const feedback = formData.get("feedback");
  const honeypot = formData.get(HONEYPOT_FIELD);

  // Pretend it worked so the bot has nothing to adapt to.
  if (typeof honeypot === "string" && honeypot !== "") {
    console.log("Feedback dropped: honeypot filled");
    return { success: true, message: "Thanks a lot for sharing 🙏" };
  }

  // Vercel BotID: the client script on /feedback attaches a challenge to the
  // server action's POST. Plain form posts (no JS) and scripted requests fail.
  const verification = await checkBotId();
  if (verification.isBot) {
    console.log("Feedback dropped: BotID flagged the request as a bot");
    return {
      success: false,
      message: "Couldn't send this one. Please email feedback@meet.hn instead.",
    };
  }

  if (typeof feedback !== "string" || feedback.trim() === "")
    return {
      success: false,
      message:
        "Can't send an empty feedback. If your feedback is just no feedback, send a ❤️",
    };

  if (feedback.length > MAX_FEEDBACK_LENGTH)
    return {
      success: false,
      message: `That's a bit long, please keep it under ${MAX_FEEDBACK_LENGTH} characters (or email feedback@meet.hn).`,
    };

  try {
    await sendMessage(chatId, escapeCharsForTelegramAPI(feedback));
  } catch (error) {
    console.error("Feedback: Telegram send failed", error);
    return {
      success: false,
      message:
        "Something went wrong on my side. Please try again or email feedback@meet.hn.",
    };
  }

  return { success: true, message: "Thanks a lot for sharing 🙏" };
};
