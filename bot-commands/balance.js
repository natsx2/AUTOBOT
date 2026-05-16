const path = require('path');
const fs = require('fs');

function getEconomy(dataDir) {
  const file = path.join(dataDir, 'economy.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return { users: {} }; }
}

module.exports.config = {
  name: "balance",
  aliases: ["bal", "coins", "wallet", "money"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Check your coin balance",
  usage: "balance [@mention]",
  cooldowns: 3,
  category: "economy"
};

module.exports.run = async function({ api, event, DATA_DIR }) {
  const { threadID, messageID, senderID, mentions } = event;

  const eco = getEconomy(DATA_DIR);
  const targetId = Object.keys(mentions || {})[0] || senderID;

  if (!eco.users[targetId]) {
    return api.sendMessage(
      targetId === senderID
        ? "❌ You are not registered. Use !register to create an account."
        : "❌ That user is not registered.",
      threadID, messageID
    );
  }

  const user = eco.users[targetId];

  // Auto-fix default placeholder names on the fly
  if (!user.name || user.name.startsWith('User_')) {
    try {
      const info = await new Promise((res) => {
        api.getUserInfo([targetId], (err, d) => res(err ? null : d));
      });
      if (info) {
        const u = info[targetId] || info[String(targetId)] || Object.values(info)[0];
        if (u?.name) {
          user.name = u.name;
          eco.users[targetId].name = u.name;
          const file = require('path').join(DATA_DIR, 'economy.json');
          require('fs').writeFileSync(file, JSON.stringify(eco, null, 2));
        }
      }
    } catch {}
  }
  const lastClaim = user.lastClaim ? new Date(user.lastClaim) : null;
  const now = new Date();
  const canClaim = !lastClaim || (now - lastClaim) >= 3600000;
  const nextClaim = lastClaim ? Math.max(0, Math.ceil((3600000 - (now - lastClaim)) / 60000)) : 0;

  const msg = [
    `💳 Balance — ${user.name}`,
    `💰 Coins: ${user.balance.toLocaleString()}`,
    `⏰ Hourly Claim: ${canClaim ? '✅ Ready!' : `⏳ ${nextClaim}m remaining`}`,
  ].join('\n');

  return api.sendMessage(msg, threadID, messageID);
};
