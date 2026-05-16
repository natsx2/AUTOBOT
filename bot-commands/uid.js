module.exports.config = {
  name: "uid",
  aliases: ["id", "getid", "fetchid"],
  version: "1.1.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Get the Facebook UID and real name of yourself or tagged users",
  usage: "uid [@mention]",
  cooldowns: 5,
  category: "utility"
};

module.exports.run = async function({ api, event }) {
  const { threadID, messageID, senderID, mentions } = event;
  const mentionedIDs = Object.keys(mentions || {});

  if (mentionedIDs.length > 0) {
    const infos = await new Promise((res) => {
      api.getUserInfo(mentionedIDs, (e, d) => res(e ? null : d));
    }).catch(() => null);
    const lines = mentionedIDs.map(id => {
      const userData = infos ? (infos[id] || infos[String(id)]) : null;
      const realName = userData?.name || mentions[id] || 'Unknown';
      return `👤 ${realName}\n🆔 UID: ${id}`;
    });
    return api.sendMessage(`📋 User Info\n\n${lines.join('\n\n')}`, threadID, messageID);
  }

  const info = await new Promise((res) => {
    api.getUserInfo([senderID], (e, d) => res(e ? null : d));
  }).catch(() => null);
  const userData = info ? (info[senderID] || info[String(senderID)] || Object.values(info)[0]) : null;
  const name = userData?.name || 'Unknown';
  const profile = userData?.profileUrl || userData?.uri || '';
  return api.sendMessage(
    `📋 Your Info\n\n👤 Name: ${name}\n🆔 UID: ${senderID}${profile ? `\n🔗 Profile: ${profile}` : ''}`,
    threadID, messageID
  );
};
