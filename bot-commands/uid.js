module.exports.config = {
  name: "uid",
  aliases: ["id", "getid"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Get the Facebook UID of yourself or a tagged user",
  usage: "uid [@mention]",
  cooldowns: 5
};

module.exports.run = async function({ api, event }) {
  const { threadID, messageID, senderID, mentions } = event;

  const mentionedIDs = Object.keys(mentions || {});
  if (mentionedIDs.length > 0) {
    const lines = mentionedIDs.map(id => `${mentions[id]}: ${id}`);
    return api.sendMessage(`User IDs:\n${lines.join("\n")}`, threadID, messageID);
  }

  const userInfo = await api.getUserInfo(senderID);
  const name = userInfo?.[senderID]?.name || "Unknown";
  return api.sendMessage(`Your UID: ${senderID}\nName: ${name}`, threadID, messageID);
};
