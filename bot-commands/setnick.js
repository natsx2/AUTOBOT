module.exports.config = {
  name: "setnick",
  aliases: ["nn", "nickname", "nick"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Set a nickname for yourself or a tagged user in this group chat",
  usage: "setnick <nickname> | setnick @user <nickname> | setnick reset",
  cooldowns: 5,
  category: "utility"
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID, mentions } = event;

  const mentionedIDs = Object.keys(mentions || {});
  const targetID = mentionedIDs[0] || senderID;

  // Filter out mention text from args
  const cleanArgs = args.filter(a => !Object.values(mentions || {}).some(n => a.includes(n.replace('@', ''))));

  const nickname = cleanArgs.join(' ').trim();

  if (!nickname && mentionedIDs.length === 0) {
    return api.sendMessage(
      '✏️ SetNick Command\n\n• !setnick <nickname> — Set your own nickname\n• !setnick @user <nickname> — Set someone\'s nickname\n• !setnick reset — Clear your nickname\n• !setnick @user reset — Clear someone\'s nickname',
      threadID, messageID
    );
  }

  const isReset = nickname.toLowerCase() === 'reset' || nickname === '';

  try {
    await new Promise((res, rej) => {
      const r = api.changeNickname(isReset ? '' : nickname, threadID, targetID, (e) => e ? rej(e) : res());
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });

    // Get the target's real name for response
    let targetName = targetID === senderID ? 'your' : `user ${targetID}'s`;
    try {
      const info = await new Promise((res, rej) => {
        const r = api.getUserInfo(targetID, (e, d) => e ? rej(e) : res(d));
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      const n = info?.[targetID]?.name;
      if (n) targetName = targetID === senderID ? `your` : `${n}'s`;
    } catch {}

    if (isReset) {
      return api.sendMessage(`✅ Cleared ${targetName} nickname!`, threadID, messageID);
    }
    return api.sendMessage(`✅ Set ${targetName} nickname to: "${nickname}"`, threadID, messageID);
  } catch (err) {
    return api.sendMessage(`❌ Failed to set nickname: ${err?.message || 'Unknown error'}`, threadID, messageID);
  }
};
