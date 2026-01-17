export async function supportSystem(bot, OWNER_ID) {
  // User -> Owner (DM)
  bot.on("message", async (ctx, next) => {
    try {
      if (!ctx.chat || ctx.chat.type !== "private") return next();

      const userId = ctx.from.id;
      const name = ctx.from.first_name || "User";
      const username = ctx.from.username ? `@${ctx.from.username}` : "No Username";

      if (userId === OWNER_ID) return next();

      await ctx.telegram.sendMessage(
        OWNER_ID,
        `📩 New Support Message\n\n👤 Name: ${name}\n🆔 ID: ${userId}\n🔗 Username: ${username}\n\n💬 Message:\n${ctx.message.text || "📎 Media/Sticker/Other"}`
      );

      await ctx.reply("✅ Your message sent to support! Owner will reply soon 💙");
    } catch (e) {
      console.log("supportSystem error:", e?.message);
    }

    return next();
  });

  // Owner -> User (reply system)
  bot.on("message", async (ctx, next) => {
    try {
      if (!ctx.chat || ctx.chat.type !== "private") return next();
      if (ctx.from.id !== OWNER_ID) return next();

      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg) return next();

      const match = replyMsg.text?.match(/ID:\s*(\d+)/);
      if (!match) return next();

      const targetUserId = Number(match[1]);
      const ownerText = ctx.message.text;

      if (!ownerText) return next();

      await ctx.telegram.sendMessage(targetUserId, `👑 Support Reply\n\n${ownerText}`);
      await ctx.reply("✅ Reply sent to user 💬");
    } catch (e) {
      console.log("Owner reply error:", e?.message);
    }

    return next();
  });
}
