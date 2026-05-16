module.exports.config = {
  name: "thread",
  aliases: ["threadinfo", "tid"],
  version: "1.0.0",
  role: 0,
  credits: "Vern",
  hasPrefix: true,
  description: "Get current thread/group information and ID",
  usage: "thread",
  cooldowns: 5
};

module.exports.run = async function({ api, event }) {
  const { threadID, messageID } = event;
  try {
    const info = await api.getThreadInfo(threadID);
    const isGroup = info.isGroup;
    const name = info.threadName || "Direct Message";
    const memberCount = info.participantIDs?.length || 0;
    const adminIDs = info.adminIDs?.map(a => a.id) || [];

    const msg = [
      `Thread ID: ${threadID}`,
      `Name: ${name}`,
      `Type: ${isGroup ? "Group" : "Direct Message"}`,
      isGroup ? `Members: ${memberCount}` : null,
      isGroup ? `Admins: ${adminIDs.length}` : null
    ].filter(Boolean).join("\n");

    return api.sendMessage(msg, threadID, messageID);
  } catch (err) {
    return api.sendMessage(`Thread ID: ${threadID}`, threadID, messageID);
  }
};
