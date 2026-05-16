module.exports.config = {
  name: "setnick",
  aliases: ["nn", "nickname", "nick"],
  version: "2.0.0",
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
  const targetID = mentionedIDs.length > 0 ? mentionedIDs[0] : senderID;

  // Strip @mentions from args to isolate the nickname text
  let cleanArgs = args.filter(a => {
    if (a.startsWith('@')) return false;
    const mentionVals = Object.values(mentions || {});
    return !mentionVals.some(m => m === a || m === `@${a}` || a === m.replace(/^@/, ''));
  });

  const nickname = cleanArgs.join(' ').trim();

  if (!nickname && mentionedIDs.length === 0) {
    return api.sendMessage(
      '✏️ SetNick Command\n\nUsage:\n• !setnick <nickname>\n• !setnick @user <nickname>\n• !setnick reset\n• !setnick @user reset\n\nExample:\n• !setnick Gamer King\n• !setnick @John Cool Guy',
      threadID, messageID
    );
  }

  const isReset = nickname.toLowerCase() === 'reset' || (nickname === '' && mentionedIDs.length > 0 && cleanArgs.length === 0);

  try {
    await new Promise((res, rej) => {
      const r = api.changeNickname(isReset ? '' : nickname, threadID, targetID, (e) => e ? rej(e) : res());
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });

    let targetName = targetID === senderID ? 'your' : `their`;
    try {
      const info = await new Promise((res, rej) => {
        const r = api.getUserInfo(targetID, (e, d) => e ? rej(e) : res(d));
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      const udata = info?.[targetID] || info?.[String(targetID)];
      if (udata?.name) targetName = targetID === senderID ? 'your' : `${udata.name}'s`;
    } catch {}

    if (isReset) {
      return api.sendMessage(`✅ Cleared ${targetName} nickname!`, threadID, messageID);
    }
    return api.sendMessage(`✅ Set ${targetName} nickname to: "${nickname}"`, threadID, messageID);
  } catch (err) {
    const msg = err?.message || String(err) || 'Unknown error';
    if (msg.includes('admin') || msg.includes('permission') || msg.includes('moderator')) {
      return api.sendMessage('❌ Bot must be an admin to change nicknames in this group.', threadID, messageID);
    }
    return api.sendMessage(`❌ Failed to set nickname: ${msg}`, threadID, messageID);
  }
};
