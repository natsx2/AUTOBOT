module.exports.config = {
  name: "uptime",
  aliases: ["up", "runtime"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Show how long the bot has been running",
  usage: "uptime",
  cooldowns: 5
};

module.exports.run = async function({ api, event, Utils }) {
  const { threadID, messageID } = event;
  const userid = api.getCurrentUserID();
  const account = Utils.account.get(userid);
  const seconds = account ? account.time : 0;

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return api.sendMessage(`Bot Uptime: ${parts.join(" ")}`, threadID, messageID);
};
