module.exports.config = {
  name: "prefix",
  aliases: ["getprefix"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Show the current bot command prefix",
  usage: "prefix",
  cooldowns: 5
};

module.exports.run = async function({ api, event, prefix }) {
  const { threadID, messageID } = event;
  return api.sendMessage(`Current prefix: ${prefix}\nExample: ${prefix}help`, threadID, messageID);
};
