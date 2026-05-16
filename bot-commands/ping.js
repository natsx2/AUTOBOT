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
  const { threadID, messageID } = event;
  const start = Date.now();
  api.sendMessage("Pinging...", threadID, (err, info) => {
    if (err) return;
    const ms = Date.now() - start;
    api.editMessage(`Pong! Response time: ${ms}ms`, info.messageID);
  });
};
