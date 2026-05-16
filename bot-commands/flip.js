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
  name: "flip",
  aliases: ["coinflip", "cf", "toss"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Flip a coin and double your bet or lose it",
  usage: "flip <heads/tails> <bet>",
  cooldowns: 5,
  category: "games"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  const eco = getEconomy(DATA_DIR);
  if (!eco.users[senderID]) {
    return api.sendMessage("❌ You are not registered. Use !register first.", threadID, messageID);
  }

  const choice = (args[0] || '').toLowerCase();
  const bet = parseInt(args[1]);

  if (!['heads', 'tails', 'h', 't'].includes(choice)) {
    return api.sendMessage("❌ Usage: !flip <heads/tails> <bet>\nExample: !flip heads 100", threadID, messageID);
  }
  if (!bet || bet <= 0) return api.sendMessage("❌ Specify a valid bet amount.\nExample: !flip heads 100", threadID, messageID);
  if (bet > eco.users[senderID].balance) {
    return api.sendMessage(`❌ Insufficient balance!\n💰 You have: ${eco.users[senderID].balance.toLocaleString()} coins`, threadID, messageID);
  }
  if (bet > 10000) return api.sendMessage("❌ Maximum bet is 10,000 coins.", threadID, messageID);

  const normalChoice = choice.startsWith('h') ? 'heads' : 'tails';
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = normalChoice === result;

  if (won) {
    eco.users[senderID].balance += bet;
  } else {
    eco.users[senderID].balance -= bet;
  }
  saveEconomy(DATA_DIR, eco);

  const coin = result === 'heads' ? '🪙' : '⚫';
  return api.sendMessage(
    `${coin} Coin Flip!\n\nYou chose: ${normalChoice.toUpperCase()}\nResult: ${result.toUpperCase()}\n\n${won ? `✅ You won! +${bet.toLocaleString()} coins` : `❌ You lost! -${bet.toLocaleString()} coins`}\n\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
    threadID, messageID
  );
};
