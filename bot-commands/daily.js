const path = require('path');
const fs = require('fs');

function getEconomy(dataDir) {
  const file = path.join(dataDir, 'economy.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return { users: {} }; }
}
function saveEconomy(dataDir, data) {
  const file = path.join(dataDir, 'economy.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports.config = {
  name: "daily",
  aliases: ["claim", "hourly"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Claim free coins every hour",
  usage: "daily",
  cooldowns: 5,
  category: "economy"
};

module.exports.run = async function({ api, event, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  const eco = getEconomy(DATA_DIR);
  if (!eco.users[senderID]) {
    return api.sendMessage(
      "❌ You are not registered. Use !register to create an account.",
      threadID, messageID
    );
  }

  const user = eco.users[senderID];
  const now = new Date();
  const lastClaim = user.lastClaim ? new Date(user.lastClaim) : null;
  const COOLDOWN = 3600000; // 1 hour

  if (lastClaim && (now - lastClaim) < COOLDOWN) {
    const remaining = COOLDOWN - (now - lastClaim);
    const mins = Math.ceil(remaining / 60000);
    return api.sendMessage(
      `⏳ You already claimed your coins!\nCome back in ${mins} minute${mins !== 1 ? 's' : ''}.`,
      threadID, messageID
    );
  }

  const reward = Math.floor(Math.random() * 200) + 100; // 100-300 coins
  eco.users[senderID].balance += reward;
  eco.users[senderID].lastClaim = now.toISOString();
  saveEconomy(DATA_DIR, eco);

  return api.sendMessage(
    `🎁 Hourly Claim!\n\n+${reward} coins added!\n💰 New Balance: ${eco.users[senderID].balance.toLocaleString()} coins\n\n⏰ Come back in 1 hour for more!`,
    threadID, messageID
  );
};
