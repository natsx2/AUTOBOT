const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: "welcome",
  aliases: ["welcomeevent"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: false,
  description: "Auto welcome new members and farewell leaving members",
  usage: "",
  cooldowns: 0,
  category: "events"
};

module.exports.handleEvent = async function({ api, event, DATA_DIR }) {
  const { threadID, logMessageType, logMessageData, logMessageBody } = event;

  if (logMessageType === 'log:subscribe') {
    const added = logMessageData?.addedParticipants || [];
    for (const user of added) {
      const name = user.fullName || user.name || `User ${user.userFbId}`;
      const uid = user.userFbId;

      let threadInfo = null;
      try {
        threadInfo = await new Promise((res, rej) => {
          const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
          if (r && typeof r.then === 'function') r.then(res).catch(rej);
        });
      } catch {}

      const threadName = threadInfo?.threadName || 'this group';
      const memberCount = threadInfo?.participantIDs?.length || '?';

      const welcomeMsgs = [
        `👋 Welcome to ${threadName}, @user! You are member #${memberCount}. Enjoy your stay! 🎉`,
        `🎊 Hey @user! Welcome to ${threadName}! Glad to have you here. You're member #${memberCount}! 😊`,
        `✨ @user just joined ${threadName}! Welcome aboard, member #${memberCount}! Make yourself at home 🏠`,
        `🌟 A new member has arrived! Welcome, @user! You are our #${memberCount} member in ${threadName} 🎈`,
        `🥳 @user joined the chat! Welcome to ${threadName}! You're member #${memberCount} — say hi everyone! 👋`,
      ];

      const msg = welcomeMsgs[Math.floor(Math.random() * welcomeMsgs.length)].replace('@user', name);

      const mentions = [{ tag: name, id: uid }];
      try {
        api.sendMessage({ body: msg, mentions }, threadID);
      } catch {
        api.sendMessage(msg, threadID);
      }
    }
  }

  if (logMessageType === 'log:unsubscribe') {
    const leftUID = logMessageData?.leftParticipantFbId;
    if (!leftUID) return;

    let name = `Someone`;
    try {
      const info = await new Promise((res, rej) => {
        const r = api.getUserInfo(leftUID, (e, d) => e ? rej(e) : res(d));
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      const u = info?.[leftUID] || info?.[String(leftUID)];
      if (u?.name) name = u.name;
    } catch {}

    const leaveMsgs = [
      `😢 ${name} has left the group. Farewell! You will be missed 💔`,
      `👋 ${name} just left. Goodbye and take care! 🌸`,
      `😔 ${name} has left the building. Until we meet again! 🙏`,
      `💨 ${name} left the group. Safe travels! 🌍`,
      `🚪 ${name} exited the chat. Goodbye! Hope to see you again 😊`,
    ];

    const msg = leaveMsgs[Math.floor(Math.random() * leaveMsgs.length)];
    try { api.sendMessage(msg, threadID); } catch {}
  }
};
