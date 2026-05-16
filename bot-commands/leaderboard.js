const path = require('path');
const fs = require('fs');

function getEconomy(dataDir) {
  const file = path.join(dataDir, 'economy.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return { users: {} }; }
}

const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports.config = {
  name: "leaderboard",
  aliases: ["lb", "top", "rich", "ranking"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Show top 10 richest users",
  usage: "leaderboard",
  cooldowns: 10,
  category: "economy"
};

module.exports.run = async function({ api, event, DATA_DIR }) {
  const { threadID, messageID } = event;

  const eco = getEconomy(DATA_DIR);
  const users = Object.entries(eco.users)
    .map(([id, u]) => ({ id, name: u.name, balance: u.balance }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  if (!users.length) {
    return api.sendMessage("📊 No registered users yet. Use !register to join!", threadID, messageID);
  }

  const lines = users.map((u, i) => `${medals[i] || `${i + 1}.`} ${u.name}\n   💰 ${u.balance.toLocaleString()} coins`);
  return api.sendMessage(`🏆 Top ${users.length} Richest Users\n\n${lines.join('\n\n')}`, threadID, messageID);
};
