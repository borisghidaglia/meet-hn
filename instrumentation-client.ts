import { initBotId } from "botid/client/core";

// Vercel BotID (basic, free): attaches an invisible challenge to these
// requests; the server checks it with checkBotId(). A server action POSTs to
// the page it runs on, so this covers the feedback form's sendFeedback.
initBotId({
  protect: [{ path: "/feedback", method: "POST" }],
});
