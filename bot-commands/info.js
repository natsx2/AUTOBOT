module.exports.config = {
  name: "info",
  aliases: ["botinfo", "about"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Show bot information and current stats",
  usage: "info",
  cooldowns: 5
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
    "AutomatedBot V3.0",
    `Name: ${account?.name || "Unknown"}`,
    `Prefix: ${prefix}`,
    `Commands: ${cmdCount}`,
    `Event Handlers: ${eventCount}`,
    `Uptime: ${h}h ${m}m ${s}s`,
    `Credits: Vern (github.com/vernesg)`
  ].join("\n");

  return api.sendMessage(msg, threadID, messageID);
};
