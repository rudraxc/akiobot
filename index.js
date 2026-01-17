import { getAIReply } from "./utils/getAIReply.js";
import { supportSystem } from "./handlers/supportSystem.js";
import { aiTagReply } from "./handlers/aiTagReply.js";
import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { config } from "./config.js";
import {
  connectDB,
  getChatSettings,
  setChatEnabled,
  getWarnings,
  resetWarnings,
  addWarning,
  saveChat,
  getAllChats,
  setWelcome,
  getWelcome,
  getSudoUsers,
  addSudoUser,
  removeSudoUser
} from "./database.js";
import { antiSpam } from "./antiSpam.js";


const OWNER_ID = Number(process.env.OWNER_ID || config.ownerId || 0);
const LOG_CHANNEL_ID = Number(process.env.LOG_CHANNEL_ID || 0);
const START_PHOTO_URL = process.env.START_PHOTO_URL || null;
const SUPPORT_CHANNEL_URL = process.env.SUPPORT_CHANNEL_URL || null;

function randEmoji() {
  const emojis = ["✨","🔥","😄","💖","⚡","🥳","🌸","😎","🫶","💫","😺","🎉","🍀","🧠","🤖"];
  return emojis[Math.floor(Math.random()*emojis.length)];
}

async function sendLog(ctx, text) {
  try {
    if (!LOG_CHANNEL_ID) return;
    await ctx.telegram.sendMessage(LOG_CHANNEL_ID, text, { disable_web_page_preview: true });
  } catch (e) {
    console.log("Log Error:", e.message);
  }
}

function typingDelayMs() {
  return 600 + Math.floor(Math.random()*1400);
}


const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OWNER_ID = Number(process.env.OWNER_ID || config.ownerId || 0);
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

if (!BOT_TOKEN) {
  console.log("❌ BOT_TOKEN missing");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.log("❌ OPENAI_API_KEY missing");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const memory = new Map();

const SYSTEM_PROMPT = `
You are an advanced Telegram AI assistant.
Rules:
- Reply fast, short, smart.
- Use Hinglish if user uses Hinglish.
- No "thinking..." messages.
- Be friendly and helpful.
`;

function isOwner(ctx) {
  return OWNER_ID && ctx.from?.id === OWNER_ID;
}
function isSudo(ctx) {
  return config.sudoUsers?.includes(ctx.from?.id);
}
async function isOwnerOrSudo(ctx) {
  const id = ctx.from?.id;
  if (!id) return false;
  if (id === OWNER_ID) return true;

  // static sudo from config
  if (Array.isArray(config.sudoUsers) && config.sudoUsers.includes(id)) return true;

  // dynamic sudo from DB
  const sudoDoc = await getSudoUsers();
  const sudoList = Array.isArray(sudoDoc.users) ? sudoDoc.users : [];
  return sudoList.includes(id);
}

async function askAI(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "❌ No reply.";
}

async function logToChannel(ctx, text) {
  if (!LOG_CHANNEL_ID) return;
  try {
    await ctx.telegram.sendMessage(LOG_CHANNEL_ID, text);
  } catch {}
}

async function getTargetUser(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

function isGroup(ctx) {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

async function botIsAdmin(ctx) {
  try {
    const me = await ctx.telegram.getMe();
    const m = await ctx.telegram.getChatMember(ctx.chat.id, me.id);
    return ["administrator", "creator"].includes(m.status);
  } catch {
    return false;
  }
}

async function canDeleteMessages(ctx) {
  try {
    const me = await ctx.telegram.getMe();
    const m = await ctx.telegram.getChatMember(ctx.chat.id, me.id);
    return m?.can_delete_messages === true || m.status === "creator";
  } catch {
    return false;
  }
}

await connectDB();

/* ✅ SAVE CHAT ALWAYS */
bot.use(async (ctx, next) => {
  try {
    if (ctx.chat?.id) {
      await saveChat(ctx.chat.id, ctx.chat?.title || "");
    }
  } catch {}
  return next();
});

/* ✅ START */
bot.start(async (ctx) => {
  const user = ctx.from;
  const name = user.first_name || "User";
  const emoji = randEmoji();

    const caption =
    `${emoji} ʜᴇʏ - ${name} 🌹

` +
    `⦿ ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ 『 ᴀɪᴋᴏ ᴀɪ ʙᴏᴛ 』 🤖💖

` +
    `➤ ᴀ ꜰᴀꜱᴛ & ꜱᴍᴀʀᴛ ᴀɪ ᴄʜᴀᴛ ʙᴏᴛ
` +
    `➤ ᴛᴀɢ ᴍᴇ ɪɴ ɢʀᴏᴜᴘ ᴛᴏ ᴄʜᴀᴛ 💬✨
` +
    `➤ ʀᴇᴘʟʏ ᴛᴏ ᴍᴇ ᴀɴᴅ ɪ ᴡɪʟʟ ʀᴇᴘʟʏ ʙᴀᴄᴋ 😄🔥

` +
    `━━━━━━━━━━━━━━━━━━━
` +
    `⦿ ᴄʟɪᴄᴋ ᴏɴ ᴛʜᴇ ʜᴇʟᴘ ʙᴜᴛᴛᴏɴ ᴛᴏ ɢᴇᴛ
` +
    `ɪɴꜰᴏ ᴀʙᴏᴜᴛ ᴄᴏᴍᴍᴀɴᴅꜱ & ꜰᴇᴀᴛᴜʀᴇꜱ ⚡
` +
    `━━━━━━━━━━━━━━━━━━━`;

  const buttons = Markup.inlineKeyboard([
    [Markup.button.url("➕ Add Me In Your Group ➕", `https://t.me/${ctx.botInfo.username}?startgroup=true`)],
    [
      Markup.button.url("👑 Owner", `tg://user?id=${OWNER_ID}`),
      Markup.button.url("📢 Support", SUPPORT_CHANNEL_URL || `tg://user?id=${OWNER_ID}`)
    ],
    [Markup.button.callback("📖 Help & Commands", "HELP_BTN")]
  ]);

  if (START_PHOTO_URL) {
    await ctx.replyWithPhoto(START_PHOTO_URL, {
      caption,
      parse_mode: "Markdown",
      ...buttons
    });
  } else {
    await ctx.reply(caption, { parse_mode: "Markdown", ...buttons });
  }

  await sendLog(
    ctx,
    `🚀 /start
👤 User: ${name} (@${user.username || "no_username"})
🆔 ID: ${user.id}
💬 Chat: ${ctx.chat.title || "Private"}
🧾 ChatID: ${ctx.chat.id}`
  );
});

  await ctx.reply(
    "🤖 Advanced AI Bot Online ✅\n\n✨ Type anything to chat 😄\n📌 In groups: tag me or reply to me.",
    ownerBtn
  );
});

/* ✅ SUPPORT */
bot.action("SUPPORT", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `${config.supportText}\n👑 Owner: ${OWNER_ID}`,
    Markup.inlineKeyboard([
      Markup.button.url("👑 Contact Owner", `tg://user?id=${OWNER_ID}`)
    ])
  );
});

/* ✅ AUTO WELCOME */
bot.on("new_chat_members", async (ctx) => {
  if (!isGroup(ctx)) return;

  const data = await getWelcome(ctx.chat.id);
  const welcomeText =
    data?.text || "👋 Welcome {name} to {chat} 💖\nEnjoy your stay 😄";

  for (const member of ctx.message.new_chat_members) {
    const name = member.first_name || "User";
    const chat = ctx.chat.title || "Group";

    const msg = welcomeText
      .replaceAll("{name}", name)
      .replaceAll("{chat}", chat);

    await ctx.reply(
      msg,
      Markup.inlineKeyboard([
        Markup.button.url("👑 Owner", `tg://user?id=${OWNER_ID}`)
      ])
    );
  }
});


bot.on("chat_member", async (ctx) => {
  try {
    const upd = ctx.update.chat_member;
    const chat = upd.chat;
    const from = upd.from;
    const oldStatus = upd.old_chat_member.status;
    const newStatus = upd.new_chat_member.status;
    const target = upd.new_chat_member.user;

    // log only changes that look like ban/kick/restrict
    if (oldStatus !== newStatus) {
      await sendLog(
        ctx,
        `🛡️ Admin Action (chat_member)
💬 Chat: ${chat.title || chat.id}
👮 By: ${from.first_name} (@${from.username || "no_username"}) [${from.id}]
🎯 Target: ${target.first_name} (@${target.username || "no_username"}) [${target.id}]
🔁 ${oldStatus} ➜ ${newStatus}`
      );
    }
  } catch (e) {
    console.log("chat_member log error:", e.message);
  }
});

bot.on("my_chat_member", async (ctx) => {
  try {
    const upd = ctx.update.my_chat_member;
    const chat = upd.chat;
    const from = upd.from;
    const oldStatus = upd.old_chat_member.status;
    const newStatus = upd.new_chat_member.status;

    if (oldStatus !== newStatus) {
      await sendLog(
        ctx,
        `🤖 Bot Status Update
💬 Chat: ${chat.title || chat.id}
👤 By: ${from.first_name} (@${from.username || "no_username"}) [${from.id}]
🔁 ${oldStatus} ➜ ${newStatus}`
      );
    }
  } catch (e) {
    console.log("my_chat_member log error:", e.message);
  }
});

/* ✅ STATUS */

bot.command("help", async (ctx) => {
  ctx.reply(
    "📖 Help & Commands\n\n" +
      "• /start - Start bot\n" +
      "• /help - Show this help\n" +
      "• /status - Bot status\n" +
      "• /on - Enable bot\n" +
      "• /off - Disable bot\n\n" +
      "💬 Group AI: Tag me to chat ✨"
  );
});

bot.command("status", async (ctx) => {
  const settings = await getChatSettings(ctx.chat.id);
  ctx.reply(
    `📊 Bot Status\n\n✅ Enabled: ${settings.enabled}\n👤 Chat: ${
      ctx.chat.title || "Private"
    }\n👑 Owner: ${OWNER_ID}\n🛡️ Sudo: ${config.sudoUsers?.join(", ")}`
  );
});

/* ✅ ON/OFF */
bot.command("on", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  await setChatEnabled(ctx.chat.id, true);
  ctx.reply("✅ Bot Enabled in this chat.");
});

bot.command("off", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  await setChatEnabled(ctx.chat.id, false);
  ctx.reply("🚫 Bot Disabled in this chat.");
});

/* ✅ SETWELCOME */
bot.command("setwelcome", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  const text = ctx.message.text.replace("/setwelcome", "").trim();
  if (!text)
    return ctx.reply(
      "Usage:\n/setwelcome Welcome {name} 😄\n\nTags:\n{name} = user name\n{chat} = group name"
    );

  await setWelcome(ctx.chat.id, text);
  ctx.reply("✅ Welcome message saved!");
});

/* ✅ BROADCAST ALL SAVED CHATS */
bot.command("broadcast", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");

  const msg = ctx.message.text.replace("/broadcast", "").trim();
  if (!msg) return ctx.reply("Usage: /broadcast your message");

  const chats = await getAllChats();
  if (!chats.length) return ctx.reply("❌ No chats saved in DB.");

  let sent = 0;
  let failed = 0;

  await ctx.reply(`📢 Broadcasting to ${chats.length} chats...`);

  for (const c of chats) {
    try {
      await ctx.telegram.sendMessage(c.chatId, `📢 Broadcast:\n\n${msg}`);
      sent++;
    } catch {
      failed++;
    }
  }

  ctx.reply(`✅ Broadcast Done\n\n📤 Sent: ${sent}\n❌ Failed: ${failed}`);
});

/* ✅ ADMIN COMMANDS */
bot.command("ban", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  const user = await getTargetUser(ctx);
  if (!user) return ctx.reply("Reply to a user message to ban.");

  if (!(await botIsAdmin(ctx))) return ctx.reply("❌ Make me admin first 😅");

  await ctx.telegram.banChatMember(ctx.chat.id, user.id);
  ctx.reply(`🚫 Banned: ${user.first_name}`);
});

bot.command("unban", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  if (!(await botIsAdmin(ctx))) return ctx.reply("❌ Make me admin first 😅");

  const replyUser = await getTargetUser(ctx);
  const args = ctx.message.text.split(" ");
  const userId = replyUser?.id || Number(args[1]);

  if (!userId) return ctx.reply("Use: /unban (reply user) OR /unban user_id");

  try {
    await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
    ctx.reply(`✅ Unbanned: ${userId}`);
  } catch {
    ctx.reply("❌ Unban failed.");
  }
});

bot.command("kick", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  const user = await getTargetUser(ctx);
  if (!user) return ctx.reply("Reply to a user message to kick.");

  if (!(await botIsAdmin(ctx))) return ctx.reply("❌ Make me admin first 😅");

  await ctx.telegram.banChatMember(ctx.chat.id, user.id);
  await ctx.telegram.unbanChatMember(ctx.chat.id, user.id);

  ctx.reply(`👢 Kicked: ${user.first_name}`);
});

bot.command("pin", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  const msgId = ctx.message.reply_to_message?.message_id;
  if (!msgId) return ctx.reply("Reply to a message to pin it.");

  if (!(await botIsAdmin(ctx))) return ctx.reply("❌ Make me admin first 😅");

  try {
    await ctx.telegram.pinChatMessage(ctx.chat.id, msgId);
    ctx.reply("📌 Pinned ✅");
  } catch {
    ctx.reply("❌ Pin failed.");
  }
});

bot.command("unpin", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  if (!(await botIsAdmin(ctx))) return ctx.reply("❌ Make me admin first 😅");

  try {
    await ctx.telegram.unpinChatMessage(ctx.chat.id);
    ctx.reply("✅ Unpinned.");
  } catch {
    ctx.reply("❌ Unpin failed.");
  }
});

bot.command("purge", async (ctx) => {
  if (!(await isOwnerOrSudo(ctx))) return ctx.reply("❌ Only Owner/Sudo can use this.");
  if (!isGroup(ctx)) return ctx.reply("❌ Works only in groups.");

  const canDel = await canDeleteMessages(ctx);
  if (!canDel) return ctx.reply("❌ Give me Delete Messages permission 😅");

  const args = ctx.message.text.split(" ");
  const count = Math.min(Number(args[1] || 10), 50);
  const replyMsg = ctx.message.reply_to_message?.message_id;

  if (!replyMsg) return ctx.reply("Reply to a message then use: /purge 10");

  let deleted = 0;
  for (let i = 0; i < count; i++) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, replyMsg - i);
      deleted++;
    } catch {}
  }

  ctx.reply(`🧹 Purge Done ✅\n🗑️ Deleted: ${deleted}`);
});


bot.on("message", async (ctx, next) => {
  try {
    if (!ctx.message) return next();
    const reply = ctx.message.reply_to_message;
    if (!reply) return next();
    if (!reply.from || !reply.from.is_bot) return next();
    if (reply.from.username !== ctx.botInfo.username) return next();

    // treat as AI query
    ctx.state.forceAI = true;
    return next();
  } catch {
    return next();
  }
});

/* ✅ AI CHAT */
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const text = ctx.message.text;

  const settings = await getChatSettings(chatId);
  if (!settings.enabled) return;

  if (ctx.chat.type !== "private" && config.groupReplyOnlyTag) {
    const me = await bot.telegram.getMe();
    const tag = `@${me.username}`;
    if (!text.includes(tag) && !ctx.message.reply_to_message) return;
  }

  const blocked = await antiSpam(ctx, config);
  if (blocked) return;

  const key = `${chatId}:${userId}`;
  const history = memory.get(key) || [];
  const shortHistory = history.slice(-config.memoryLimit);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...shortHistory,
    { role: "user", content: text }
  ];

  try {
    const reply = await askAI(messages);

    memory.set(key, [
      ...shortHistory,
      { role: "user", content: text },
      { role: "assistant", content: reply }
    ]);

    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    await new Promise(r=>setTimeout(r, typingDelayMs()));
    await ctx.reply(reply);
  } catch (e) {
    console.log("AI Error:", e.message);
    ctx.reply("❌ Error aa gaya 😅");
  }
});


// ====== TAG AI + SUPPORT SYSTEM ======
let BOT_USERNAME = "";
bot.telegram.getMe().then((me) => {
  BOT_USERNAME = me.username;
  console.log("Bot Username:", BOT_USERNAME);
});

// Enable support system (DM)
supportSystem(bot, OWNER_ID);

// Group AI only when tagged or replying
bot.on("text", async (ctx) => {
  await aiTagReply(ctx, BOT_USERNAME, getAIReply);
});
// =====================================

bot.launch();
console.log("🚀 Advanced AI Bot Running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
/* ✅ SUDO MANAGER (max 10) */
bot.command("sudoadd", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply("❌ Only Owner can use this.");
  const replyUser = ctx.message.reply_to_message?.from;
  const argId = Number((ctx.message.text || "").split(" ")[1]);

  const userId = replyUser?.id || argId;
  if (!userId) return ctx.reply("Reply to user or use: /sudoadd <user_id>");

  const res = await addSudoUser(userId);
  if (!res.ok) {
    if (res.reason === "LIMIT") return ctx.reply("⚠️ Max 10 sudo users allowed.");
    if (res.reason === "EXISTS") return ctx.reply("✅ Already sudo.");
    if (res.reason === "NO_DB") return ctx.reply("⚠️ DB not connected. Add MONGO_URI.");
    return ctx.reply("❌ Failed.");
  }

  ctx.reply(`✅ Added SUDO: ${userId}`);
});

bot.command("sudodel", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply("❌ Only Owner can use this.");
  const replyUser = ctx.message.reply_to_message?.from;
  const argId = Number((ctx.message.text || "").split(" ")[1]);

  const userId = replyUser?.id || argId;
  if (!userId) return ctx.reply("Reply to user or use: /sudodel <user_id>");

  const res = await removeSudoUser(userId);
  if (!res.ok) {
    if (res.reason === "NO_DB") return ctx.reply("⚠️ DB not connected. Add MONGO_URI.");
    return ctx.reply("❌ Failed.");
  }

  ctx.reply(`🗑️ Removed SUDO: ${userId}`);
});

bot.command("sudolist", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply("❌ Only Owner can use this.");
  const doc = await getSudoUsers();
  const list = Array.isArray(doc.users) ? doc.users : [];
  if (!list.length) return ctx.reply("📭 No sudo users saved.");

  ctx.reply(`👮 Sudo Users (${list.length}/10):\n\n` + list.map((x) => `• ${x}`).join("\n"));
});


