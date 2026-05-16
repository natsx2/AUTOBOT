module.exports.config = {
  name: "ping",
  aliases: ["p", "pong"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Check bot response time and connection status",
  usage: "ping",
  cooldowns: 5
};

module.exports.run = async function({ api, event }) {
  const { threadID } = event;
  const start = Date.now();
  const info = await api.sendMessage("Pinging...", threadID);
  const ms = Date.now() - start;
  if (info && info.messageID) {
    api.editMessage(`Pong! Response time: ${ms}ms`, info.messageID);
  }
};
