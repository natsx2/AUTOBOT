const path = require('path');
const fs = require('fs');

function getLockData(dataDir) {
  const f = path.join(dataDir, 'grouplock.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return {}; }
}
function saveLockData(dataDir, data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'grouplock.json'), JSON.stringify(data, null, 2));
}

module.exports.config = {
  name: "grouplock",
  aliases: ["glock", "lockname"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Lock or unlock the group chat name so no one can change it",
  usage: "grouplock on | grouplock off",
  cooldowns: 5,
  category: "admin"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID } = event;
  const sub = (args[0] || '').toLowerCase();

  if (!sub || (sub !== 'on' && sub !== 'off')) {
    return api.sendMessage(
      '🔒 GroupLock Command\n\n• !grouplock on — Lock group name (no one can change it)\n• !grouplock off — Unlock group name\n\nWhen locked, any name change will be instantly reverted.',
      threadID, messageID
    );
  }

  const lockData = getLockData(DATA_DIR);

  if (sub === 'on') {
    let currentName = 'Locked Group';
    try {
      const info = await new Promise((res, rej) => {
        const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      currentName = info?.threadName || info?.name || 'Locked Group';
    } catch {}

    lockData[threadID] = { locked: true, name: currentName };
    saveLockData(DATA_DIR, lockData);
    return api.sendMessage(
      `🔒 Group name locked!\n\n📌 Protected name: "${currentName}"\n\n⚠️ Any attempt to change the name will be instantly reverted.`,
      threadID, messageID
    );
  }

  if (sub === 'off') {
    delete lockData[threadID];
    saveLockData(DATA_DIR, lockData);
    return api.sendMessage('🔓 Group name unlocked! Members can now change the group name.', threadID, messageID);
  }
};

module.exports.handleEvent = async function({ api, event, DATA_DIR }) {
  if (event.logMessageType !== 'log:thread-name') return;

  const { threadID } = event;
  const lockData = getLockData(DATA_DIR);
  const lock = lockData[threadID];

  if (!lock || !lock.locked) return;

  const newName = event.logMessageData?.name || '';
  if (newName === lock.name) return;

  // Revert instantly
  try {
    await new Promise((res, rej) => {
      const r = api.setTitle(lock.name, threadID, (e) => e ? rej(e) : res());
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    api.sendMessage(`🔒 GroupLock active! Name reverted back to:\n"${lock.name}"`, threadID);
  } catch (err) {
    console.error('[GroupLock] Revert failed:', err?.message);
  }
};
