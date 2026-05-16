module.exports.config = {
  name: "kickall",
  aliases: ["removeall", "cleargroup"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Kick all non-admin members from the group (bot must be admin)",
  usage: "kickall [confirm]",
  cooldowns: 30,
  category: "admin"
};

module.exports.run = async function({ api, event, args, admin }) {
  const { threadID, messageID, senderID } = event;

  const confirm = (args[0] || '').toLowerCase();
  if (confirm !== 'confirm') {
    return api.sendMessage(
      '⚠️ DANGER ZONE\n\nThis command will kick ALL non-admin members from the group!\n\nTo confirm, type:\n!kickall confirm\n\n⚠️ This action cannot be undone!',
      threadID, messageID
    );
  }

  let threadInfo = null;
  try {
    threadInfo = await new Promise((res, rej) => {
      const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
  } catch (e) {
    return api.sendMessage('❌ Failed to get group info: ' + (e?.message || e), threadID, messageID);
  }

  const botID = api.getCurrentUserID();
  const isBotAdmin = threadInfo?.adminIDs?.some(a => (a.id || a) === botID);
  if (!isBotAdmin) {
    return api.sendMessage('❌ I need to be an admin in this group to kick members!', threadID, messageID);
  }

  const adminIDs = (threadInfo?.adminIDs || []).map(a => a.id || a);
  const participants = (threadInfo?.participantIDs || []).filter(id => {
    if (id === botID) return false;
    if (id === senderID) return false;
    if (adminIDs.includes(id)) return false;
    if ((admin || []).includes(id)) return false;
    return true;
  });

  if (participants.length === 0) {
    return api.sendMessage('✅ No members to kick! Only admins remain.', threadID, messageID);
  }

  await api.sendMessage(`🚀 Starting kickall... Removing ${participants.length} members.`, threadID);

  let kicked = 0;
  let failed = 0;

  for (const uid of participants) {
    try {
      await new Promise((res, rej) => {
        const r = api.removeUserFromGroup(uid, threadID, (e) => e ? rej(e) : res());
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      kicked++;
      await new Promise(r => setTimeout(r, 500));
    } catch {
      failed++;
    }
  }

  return api.sendMessage(
    `✅ Kickall complete!\n\n• Kicked: ${kicked} members\n• Failed: ${failed} members\n• Admins kept: ${adminIDs.length}`,
    threadID, messageID
  );
};
