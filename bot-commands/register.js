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
  name: "register",
  aliases: ["reg", "signup"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Register an account and receive 500 starter coins",
  usage: "register",
  cooldowns: 10,
  category: "economy"
};

module.exports.run = async function({ api, event, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  const eco = getEconomy(DATA_DIR);
  if (eco.users[senderID]) {
    const user = eco.users[senderID];
    return api.sendMessage(
      `✅ You are already registered!\n👤 Name: ${user.name}\n💰 Balance: ${user.balance.toLocaleString()} coins`,
      threadID, messageID
    );
  }

  let name = `User_${senderID}`;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.getUserInfo(senderID, (err, d) => err ? rej(err) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    name = info?.[senderID]?.name || name;
  } catch {}

  eco.users[senderID] = {
    name,
    balance: 500,
    lastClaim: null,
    registeredAt: new Date().toISOString()
  };
  saveEconomy(DATA_DIR, eco);

  return api.sendMessage(
    `🎉 Welcome, ${name}!\n\nYou've been registered and received 500 starter coins!\n💰 Balance: 500 coins\n\n💡 Use !daily to claim coins every hour.`,
    threadID, messageID
  );
};
