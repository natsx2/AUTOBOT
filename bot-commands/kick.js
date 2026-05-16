module.exports.config = {
  name: "kick",
  aliases: ["remove", "ban"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Kick a tagged user from the group (bot must be admin)",
  usage: "kick @user [reason]",
  cooldowns: 5,
  category: "admin"
};

module.exports.run = async function({ api, event, args, admin }) {
  const { threadID, messageID, senderID, mentions } = event;

  const mentionedIDs = Object.keys(mentions || {});
  if (mentionedIDs.length === 0) {
    return api.sendMessage(
      '❌ Please tag a user to kick.\n\nUsage: !kick @user [reason]\n\nExample: !kick @John Spamming',
      threadID, messageID
    );
  }

  const targetID = mentionedIDs[0];
  const botID = api.getCurrentUserID();

  if (targetID === botID) {
    return api.sendMessage('❌ I cannot kick myself!', threadID, messageID);
  }
  if (targetID === senderID) {
    return api.sendMessage('❌ You cannot kick yourself!', threadID, messageID);
  }

  let threadInfo = null;
  try {
    threadInfo = await new Promise((res, rej) => {
      const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
  } catch {}

  const isBotAdmin = threadInfo?.adminIDs?.some(a => (a.id || a) === botID);
  if (!isBotAdmin) {
    return api.sendMessage('❌ I need to be a group admin to kick members!', threadID, messageID);
  }

  const isTargetAdmin = threadInfo?.adminIDs?.some(a => (a.id || a) === targetID);
  if (isTargetAdmin) {
    return api.sendMessage('❌ Cannot kick a group admin!', threadID, messageID);
  }

  let targetName = mentions[targetID] || `User ${targetID}`;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.getUserInfo(targetID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    const u = info?.[targetID] || info?.[String(targetID)];
    if (u?.name) targetName = u.name;
  } catch {}

  const reasonArgs = args.filter(a => !a.startsWith('@') && !Object.values(mentions).some(n => n === a || n === `@${a}`));
  const reason = reasonArgs.join(' ').trim() || 'No reason specified';

  try {
    await new Promise((res, rej) => {
      const r = api.removeUserFromGroup(targetID, threadID, (e) => e ? rej(e) : res());
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    return api.sendMessage(
      `🚫 ${targetName} has been kicked from the group.\n📋 Reason: ${reason}`,
      threadID, messageID
    );
  } catch (err) {
    return api.sendMessage(`❌ Failed to kick ${targetName}: ${err?.message || 'Unknown error'}`, threadID, messageID);
  }
};
