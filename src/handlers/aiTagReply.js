export async function aiTagReply(ctx, botUsername, getAIReply) {
  try {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

    const text = ctx.message?.text || ctx.message?.caption || "";
    if (!text) return;

    const isTagged = text.includes(`@${botUsername}`);
    const isReplyToBot =
      ctx.message?.reply_to_message?.from?.is_bot &&
      ctx.message?.reply_to_message?.from?.username === botUsername;

    if (!isTagged && !isReplyToBot) return;

    const cleanPrompt = text.replaceAll(`@${botUsername}`, "").trim();
    const prompt = cleanPrompt.length > 0 ? cleanPrompt : "Hello";

    await ctx.sendChatAction("typing");

    const aiText = await getAIReply(prompt, ctx.from?.first_name || "User");

    return ctx.reply(aiText, {
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (err) {
    console.log("aiTagReply error:", err?.message);
  }
}
