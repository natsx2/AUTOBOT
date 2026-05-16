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

const SYMBOLS = ['🍎', '🍊', '🍋', '🍒', '🍇', '⭐', '💎', '7️⃣'];
const PAYOUTS = { '💎': 10, '7️⃣': 8, '⭐': 5, '🍒': 3, '🍇': 2, '🍋': 1.5, '🍊': 1.2, '🍎': 1 };

module.exports.config = {
  name: "slots",
  aliases: ["slot", "spin"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Play the slot machine and win coins!",
  usage: "slots <bet>",
  cooldowns: 5,
  category: "games"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  const eco = getEconomy(DATA_DIR);
  if (!eco.users[senderID]) {
    return api.sendMessage("❌ You are not registered. Use !register first.", threadID, messageID);
  }

  const bet = parseInt(args[0]);
  if (!bet || bet <= 0) return api.sendMessage("❌ Usage: !slots <bet amount>\nExample: !slots 100", threadID, messageID);
  if (bet > eco.users[senderID].balance) {
    return api.sendMessage(`❌ Insufficient balance!\n💰 You have: ${eco.users[senderID].balance.toLocaleString()} coins`, threadID, messageID);
  }
  if (bet > 10000) return api.sendMessage("❌ Maximum bet is 10,000 coins.", threadID, messageID);

  const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const [s1, s2, s3] = [spin(), spin(), spin()];

  let winnings = 0;
  let resultMsg = '';

  if (s1 === s2 && s2 === s3) {
    const multiplier = PAYOUTS[s1] || 1;
    winnings = Math.floor(bet * multiplier * 3);
    resultMsg = `🎰 JACKPOT! Three ${s1}!\n+${winnings.toLocaleString()} coins!`;
  } else if (s1 === s2 || s2 === s3 || s1 === s3) {
    winnings = Math.floor(bet * 0.5);
    resultMsg = `🎰 Two of a kind!\n+${winnings.toLocaleString()} coins`;
  } else {
    winnings = -bet;
    resultMsg = `🎰 No match!\n-${bet.toLocaleString()} coins`;
  }

  eco.users[senderID].balance += winnings;
  saveEconomy(DATA_DIR, eco);

  return api.sendMessage(
    `🎰 Slot Machine\n\n[ ${s1} | ${s2} | ${s3} ]\n\n${resultMsg}\n\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
    threadID, messageID
  );
};
