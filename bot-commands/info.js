module.exports.config = {
  name: "info",
  aliases: ["botinfo", "about"],
  version: "2.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Show bot information and developer contacts",
  usage: "info",
  cooldowns: 5,
  category: "utility"
};

module.exports.run = async function({ api, event, prefix, Utils }) {
  const { threadID, messageID } = event;
  const userid = api.getCurrentUserID();
  const account = Utils.account.get(userid);
  const cmdCount = Utils.commands.size;
  const eventCount = Utils.handleEvent.size;

  const seconds = account ? account.time : 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const msg = [
    "╔══════════════════╗",
    "   🤖 AUTOBOT V3.0   ",
    "╚══════════════════╝",
    "",
    `👤 Bot Name: ${account?.name || "Unknown"}`,
    `🔑 Prefix: ${prefix}`,
    `⚙️  Commands: ${cmdCount}`,
    `📡 Events: ${eventCount}`,
    `⏱️  Uptime: ${h}h ${m}m ${s}s`,
    "",
    "👨‍💻 Developer",
    "📘 Facebook: https://www.facebook.com/notfound500",
    "📢 Telegram: https://t.me/trciks",
    "",
    "💡 Type !help to see all commands"
  ].join("\n");

  return api.sendMessage(msg, threadID, messageID);
};
