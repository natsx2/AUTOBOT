const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: "antispam",
  aliases: ["spamdetect", "antiabuse"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: false,
  description: "Auto kick users who spam or use inappropriate words 5+ times",
  usage: "",
  cooldowns: 0,
  category: "events"
};

const badWords = [
  'putangina', 'puta', 'gago', 'ulol', 'bobo', 'tanga', 'leche', 'buwisit',
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'dick', 'idiot', 'moron',
  'pakyu', 'pakyo', 'pakshet', 'punyeta', 'tarantado', 'hayop', 'pesteng',
  'fuckyou', 'stfu', 'shutup', 'stupid', 'dumbass',
];

const spamTracker = new Map();
const warned = new Map();

const SPAM_THRESHOLD = 5;
const SPAM_WINDOW = 10 * 1000;
const WARN_WINDOW = 60 * 1000;

function getBadWordCount(text) {
  const lower = text.toLowerCase().replace(/\s+/g, '');
  return badWords.filter(w => lower.includes(w)).length;
}

module.exports.handleEvent = async function({ api, event, admin, DATA_DIR }) {
  if (event.type !== 'message') return;
  const { threadID, senderID, body } = event;
  if (!body) return;

  const botID = api.getCurrentUserID();
  if (senderID === botID) return;
  if ((admin || []).includes(senderID)) return;

  const now = Date.now();
  const key = `${threadID}_${senderID}`;
  const tracker = spamTracker.get(key) || { messages: [], badCount: 0, warnedAt: 0 };

  tracker.messages = tracker.messages.filter(t => now - t < SPAM_WINDOW);

  const hasBadWord = getBadWordCount(body) > 0;
  if (hasBadWord) tracker.badCount = (tracker.badCount || 0) + 1;
  else tracker.badCount = Math.max(0, (tracker.badCount || 0) - 1);

  tracker.messages.push(now);
  spamTracker.set(key, tracker);

  const isSpamming = tracker.messages.length >= SPAM_THRESHOLD;
  const isAbusing = tracker.badCount >= SPAM_THRESHOLD;

  if (!isSpamming && !isAbusing) return;

  const warnKey = `${threadID}_${senderID}_warn`;
  const lastWarn = warned.get(warnKey) || 0;

  let userName = `User`;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.getUserInfo(senderID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    const u = info?.[senderID] || info?.[String(senderID)];
    if (u?.name) userName = u.name;
  } catch {}

  let threadInfo = null;
  try {
    threadInfo = await new Promise((res, rej) => {
      const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
  } catch {}

  const isBotAdmin = threadInfo?.adminIDs?.some(a => (a.id || a) === botID);

  const reason = isAbusing ? 'using inappropriate words repeatedly' : 'spamming';

  if (now - lastWarn < WARN_WINDOW) return;
  warned.set(warnKey, now);

  spamTracker.delete(key);

  if (!isBotAdmin) {
    api.sendMessage(
      `⚠️ @${userName} Warning! Stop ${reason}! I need to be an admin to take action.`,
      threadID
    );
    return;
  }

  try {
    await new Promise((res, rej) => {
      const r = api.removeUserFromGroup(senderID, threadID, (e) => e ? rej(e) : res());
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    api.sendMessage(
      `🚫 ${userName} has been kicked for ${reason}.\n\n⚠️ Rule reminder: No spamming or using inappropriate language in this group!`,
      threadID
    );
  } catch {
    api.sendMessage(
      `⚠️ Could not kick ${userName}. Please make sure I am an admin in this group.`,
      threadID
    );
  }
};
