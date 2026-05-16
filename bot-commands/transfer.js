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
  name: "transfer",
  aliases: ["send", "pay", "give"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Transfer coins to another user",
  usage: "transfer @user <amount>",
  cooldowns: 10,
  category: "economy"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID, mentions } = event;

  const eco = getEconomy(DATA_DIR);
  if (!eco.users[senderID]) {
    return api.sendMessage("❌ You are not registered. Use !register first.", threadID, messageID);
  }

  const targetId = Object.keys(mentions || {})[0];
  if (!targetId) return api.sendMessage("❌ Please mention a user to transfer to.\nUsage: !transfer @user <amount>", threadID, messageID);
  if (targetId === senderID) return api.sendMessage("❌ You can't transfer to yourself!", threadID, messageID);
  if (!eco.users[targetId]) return api.sendMessage("❌ That user is not registered.", threadID, messageID);

  const amount = parseInt(args.find(a => !isNaN(parseInt(a))));
  if (!amount || amount <= 0) return api.sendMessage("❌ Please specify a valid amount.\nUsage: !transfer @user <amount>", threadID, messageID);
  if (amount > eco.users[senderID].balance) {
    return api.sendMessage(`❌ Insufficient balance!\n💰 Your balance: ${eco.users[senderID].balance.toLocaleString()} coins`, threadID, messageID);
  }

  eco.users[senderID].balance -= amount;
  eco.users[targetId].balance += amount;
  saveEconomy(DATA_DIR, eco);

  return api.sendMessage(
    `✅ Transfer Complete!\n\n${eco.users[senderID].name} → ${eco.users[targetId].name}\n💸 Amount: ${amount.toLocaleString()} coins\n\n💰 Your balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
    threadID, messageID
  );
};
