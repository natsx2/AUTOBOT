const { addWarning, clearWarnings } = require('./warn');

module.exports.config = {
  name: "antispam",
  aliases: ["spamdetect", "antiabuse"],
  version: "1.1.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: false,
  description: "Auto-warn then auto-kick users who spam or use bad words (uses !warn strike system)",
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

const WARN_MAX = 3;
const SPAM_THRESHOLD = 5;
const SPAM_WINDOW = 10 * 1000;
const COOLDOWN = 60 * 1000;

// In-memory rate trackers (reset on restart, intentional)
const spamTracker = new Map();
const cooldowns = new Map();

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

  const tracker = spamTracker.get(key) || { messages: [], badCount: 0 };
  tracker.messages = tracker.messages.filter(t => now - t < SPAM_WINDOW);

  const hasBadWord = getBadWordCount(body) > 0;
  if (hasBadWord) tracker.badCount = (tracker.badCount || 0) + 1;
  else tracker.badCount = Math.max(0, (tracker.badCount || 0) - 1);

  tracker.messages.push(now);
  spamTracker.set(key, tracker);

  const isSpamming = tracker.messages.length >= SPAM_THRESHOLD;
  const isAbusing = tracker.badCount >= SPAM_THRESHOLD;
  if (!isSpamming && !isAbusing) return;

  // Cooldown per user per thread to avoid repeat triggers
  const lastAction = cooldowns.get(key) || 0;
  if (now - lastAction < COOLDOWN) return;
  cooldowns.set(key, now);
  spamTracker.delete(key);

  const reason = isAbusing ? 'using bad words repeatedly' : 'spamming';

  // Resolve user name
  let userName = `User`;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.getUserInfo(senderID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    const u = info?.[senderID] || info?.[String(senderID)];
    if (u?.name) userName = u.name;
  } catch {}

  // Check bot admin status
  let isBotAdmin = false;
  try {
    const threadInfo = await new Promise((res, rej) => {
      const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    isBotAdmin = threadInfo?.adminIDs?.some(a => (a.id || a) === botID);
  } catch {}

  // Add to persistent warn count
  const warnCount = addWarning(DATA_DIR, threadID, senderID);
  const remaining = WARN_MAX - warnCount;
  const bars = '🟥'.repeat(warnCount) + '⬜'.repeat(Math.max(0, remaining));

  if (warnCount >= WARN_MAX) {
    // Auto-kick
    clearWarnings(DATA_DIR, threadID, senderID);
    if (!isBotAdmin) {
      return api.sendMessage(
        `🚨 ${userName} reached ${WARN_MAX}/${WARN_MAX} warnings for ${reason}!\n\n❌ Cannot auto-kick — I need admin rights. Please remove them manually.`,
        threadID
      );
    }
    try {
      await new Promise((res, rej) => {
        const r = api.removeUserFromGroup(senderID, threadID, (e) => e ? rej(e) : res());
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      api.sendMessage(
        `🚫 ${userName} has been auto-kicked!\n\n⚠️ Reason: ${reason} (reached ${WARN_MAX}/${WARN_MAX} warnings)\n\nRule reminder: No spamming or using bad language in this group!`,
        threadID
      );
    } catch {
      api.sendMessage(
        `⚠️ Could not kick ${userName} even though they reached max warnings. Make sure I'm an admin!`,
        threadID
      );
    }
  } else {
    // Issue warning
    api.sendMessage(
      `⚠️ Warning for ${userName}!\n\n${bars}\n📊 Strikes: ${warnCount}/${WARN_MAX}\n📋 Reason: ${reason}\n\n${remaining === 1 ? '🚨 One more strike = AUTO-KICK!' : `${remaining} more strike(s) until auto-kick.`}`,
      threadID
    );
  }
};
