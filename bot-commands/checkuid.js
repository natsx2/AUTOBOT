const axios = require('axios');

// Same logic as Python check_facebook_profile_picture()
async function checkUID(uid) {
  const url = `https://graph.facebook.com/${uid}/picture?type=normal`;
  try {
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36',
      },
      maxRedirects: 0,
      validateStatus: s => s === 302 || s === 200 || s === 404,
      timeout: 10000,
    });

    if (resp.status === 302) {
      const loc = resp.headers?.location || '';
      if (loc.includes('scontent')) return 'live';
      return 'dead';
    }
    if (resp.status === 404) return 'dead';
    return 'unknown';
  } catch (err) {
    if (err.response?.status === 302) {
      const loc = err.response.headers?.location || '';
      return loc.includes('scontent') ? 'live' : 'dead';
    }
    return 'error';
  }
}

module.exports.config = {
  name: 'checkuid',
  aliases: ['checkfb', 'uidcheck', 'fbcheck', 'checkid'],
  version: '1.0.0',
  role: 0,
  credits: 'AutoBot',
  hasPrefix: true,
  description: 'Check if a Facebook UID is live/active. !checkuid <uid> or multiple UIDs',
  usage: 'checkuid <uid> [uid2] [uid3]...',
  cooldowns: 5,
  category: 'utility',
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  if (args.length === 0) {
    return api.sendMessage(
      '🔍 Check UID Command\n\nUsage:\n• !checkuid <uid> — Check one UID\n• !checkuid <uid1> <uid2> <uid3> — Check multiple UIDs (max 10)',
      threadID, messageID
    );
  }

  // Sanitize and limit to 10
  const uids = args
    .map(a => a.replace(/[^0-9]/g, '').trim())
    .filter(a => a.length > 5)
    .slice(0, 10);

  if (uids.length === 0) {
    return api.sendMessage('❌ No valid UIDs provided. UIDs are numeric (e.g. 100012345678).', threadID, messageID);
  }

  // Status message
  let statusMsgID = null;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.sendMessage(
        `🔍 Checking ${uids.length} UID(s)...\n⏳ Please wait...`,
        threadID, (err, d) => (err ? rej(err) : res(d)), messageID
      );
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    statusMsgID = info?.messageID;
  } catch {}

  const results = await Promise.all(uids.map(async uid => {
    const status = await checkUID(uid);
    return { uid, status };
  }));

  let live = 0, dead = 0, unknown = 0;
  let report = `🔍 UID CHECK RESULTS\n━━━━━━━━━━━━━━━━━━\n`;

  for (const r of results) {
    if (r.status === 'live') {
      report += `✅ LIVE  | ${r.uid}\n`;
      live++;
    } else if (r.status === 'dead') {
      report += `❌ DEAD  | ${r.uid}\n`;
      dead++;
    } else {
      report += `⚠️ UNK   | ${r.uid}\n`;
      unknown++;
    }
  }

  report += `━━━━━━━━━━━━━━━━━━\n`;
  report += `✅ Live: ${live}  ❌ Dead: ${dead}  ⚠️ Unknown: ${unknown}`;

  if (statusMsgID) {
    try { api.editMessage(report, statusMsgID); return; } catch {}
  }
  api.sendMessage(report, threadID);
};
