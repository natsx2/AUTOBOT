module.exports.config = {
  name: "greet",
  aliases: ["hello", "hi"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Greet a user or the whole group",
  usage: "greet [@mention]",
  cooldowns: 5
};

module.exports.run = async function({ api, event }) {
  const { threadID, messageID, senderID, mentions } = event;

  const mentionedIDs = Object.keys(mentions || {});
  if (mentionedIDs.length > 0) {
    const names = mentionedIDs.map(id => mentions[id]).join(", ");
    return api.sendMessage(`Hello, ${names}! Hope you're having a great day!`, threadID, messageID);
  }

  const userInfo = await api.getUserInfo(senderID).catch(() => null);
  const name = userInfo?.[senderID]?.name || "there";
  return api.sendMessage(`Hello, ${name}! How can I help you today?`, threadID, messageID);
};
