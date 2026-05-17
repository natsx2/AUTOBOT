const fs = require('fs');
const path = require('path');

const WARN_MAX = 3;

function getWarnings(dataDir) {
  const f = path.join(dataDir, 'warnings.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return {}; }
}

function saveWarnings(dataDir, data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'warnings.json'), JSON.stringify(data, null, 2));
}

// Exported so antispam/other events can also trigger warnings
module.exports.addWarning = function addWarning(dataDir, threadID, userID) {
  const warnings = getWarnings(dataDir);
  const key = `${threadID}_${userID}`;
  warnings[key] = (warnings[key] || 0) + 1;
  saveWarnings(dataDir, warnings);
  return warnings[key];
};

module.exports.getWarningCount = function getWarningCount(dataDir, threadID, userID) {
  const warnings = getWarnings(dataDir);
  return warnings[`${threadID}_${userID}`] || 0;
};

module.exports.clearWarnings = function clearWarnings(dataDir, threadID, userID) {
  const warnings = getWarnings(dataDir);
  delete warnings[`${threadID}_${userID}`];
  saveWarnings(dataDir, warnings);
};

module.exports.config = {
  name: "warn",
  aliases: ["warning", "strike"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Warn a user — auto-kicks after 3 warnings. !warn @user [reason] | !warn @user clear",
  usage: "warn @user [reason] | warn @user clear",
  cooldowns: 5,
  category: "admin"
};

module.exports.run = async function({ api, event, args, admin, DATA_DIR }) {
  const { threadID, messageID, senderID, mentions } = event;

  const mentionedIDs = Object.keys(mentions || {});
  if (mentionedIDs.length === 0) {
    return api.sendMessage(
      '⚠️ Warn Command\n\nUsage:\n• !warn @user [reason] — Warn a user (auto-kicks at 3)\n• !warn @user clear — Clear all warnings for a user\n• !warn @user check — Check warning count',
      threadID, messageID
    );
  }

  const targetID = mentionedIDs[0];
  const botID = api.getCurrentUserID();

  if (targetID === botID) return api.sendMessage('❌ Cannot warn myself!', threadID, messageID);
  if (targetID === senderID) return api.sendMessage('❌ Cannot warn yourself!', threadID, messageID);

  // Get target name
  let targetName = mentions[targetID]?.replace('@', '') || `User ${targetID}`;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.getUserInfo(targetID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    const u = info?.[targetID] || info?.[String(targetID)];
    if (u?.name) targetName = u.name;
  } catch {}

  const cleanArgs = args.filter(a => !a.startsWith('@') && !Object.values(mentions).some(n => n === a || `@${a}` === n));
  const sub = cleanArgs[0]?.toLowerCase();

  // Clear warnings
  if (sub === 'clear' || sub === 'reset') {
    module.exports.clearWarnings(DATA_DIR, threadID, targetID);
    return api.sendMessage(`✅ Cleared all warnings for ${targetName}.`, threadID, messageID);
  }

  // Check warnings
  if (sub === 'check') {
    const count = module.exports.getWarningCount(DATA_DIR, threadID, targetID);
    return api.sendMessage(`📋 ${targetName} has ${count}/${WARN_MAX} warnings.`, threadID, messageID);
  }

  // Add warning
  const reason = cleanArgs.join(' ').trim() || 'No reason specified';
  const warnCount = module.exports.addWarning(DATA_DIR, threadID, targetID);

  if (warnCount >= WARN_MAX) {
    // Check if bot is admin before kicking
    let threadInfo = null;
    try {
      threadInfo = await new Promise((res, rej) => {
        const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
    } catch {}

    const isBotAdmin = threadInfo?.adminIDs?.some(a => (a.id || a) === botID);
    module.exports.clearWarnings(DATA_DIR, threadID, targetID);

    if (isBotAdmin) {
      try {
        await new Promise((res, rej) => {
          const r = api.removeUserFromGroup(targetID, threadID, (e) => e ? rej(e) : res());
          if (r && typeof r.then === 'function') r.then(res).catch(rej);
        });
        return api.sendMessage(
          `🚫 ${targetName} has been kicked!\n\n⚠️ Reason: Reached ${WARN_MAX}/${WARN_MAX} warnings.\n📋 Last reason: ${reason}\n\nWarnings have been reset.`,
          threadID, messageID
        );
      } catch {
        return api.sendMessage(
          `⚠️ ${targetName} reached ${WARN_MAX} warnings but I couldn't kick them. Make sure I'm an admin!\n📋 Reason: ${reason}`,
          threadID, messageID
        );
      }
    } else {
      return api.sendMessage(
        `⚠️ ${targetName} has reached ${WARN_MAX}/${WARN_MAX} warnings!\n📋 Reason: ${reason}\n\n❌ Cannot auto-kick — I need to be a group admin. Please kick them manually.`,
        threadID, messageID
      );
    }
  }

  const remaining = WARN_MAX - warnCount;
  const bars = '🟥'.repeat(warnCount) + '⬜'.repeat(remaining);

  return api.sendMessage(
    `⚠️ Warning issued to ${targetName}!\n\n${bars}\n📊 Warnings: ${warnCount}/${WARN_MAX}\n📋 Reason: ${reason}\n\n${remaining === 1 ? '🚨 One more warning = AUTO-KICK!' : `${remaining} more warning(s) until auto-kick.`}`,
    threadID, messageID
  );
};
