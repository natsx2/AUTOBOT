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

const activeGames = new Map();

module.exports.config = {
  name: "guess",
  aliases: ["number", "numguess"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Guess a number between 1-100. Win 3x your bet!",
  usage: "guess <bet> | guess <number>",
  cooldowns: 3,
  category: "games"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  const eco = getEconomy(DATA_DIR);
  if (!eco.users[senderID]) {
    return api.sendMessage("❌ You are not registered. Use !register first.", threadID, messageID);
  }

  const gameKey = `${senderID}_${threadID}`;
  const existing = activeGames.get(gameKey);

  if (existing) {
    const guess = parseInt(args[0]);
    if (!guess || guess < 1 || guess > 100) {
      return api.sendMessage(`🔢 Your active game: Bet ${existing.bet} coins\nGuess a number between 1 and 100!`, threadID, messageID);
    }

    activeGames.delete(gameKey);
    const { secret, bet } = existing;

    if (guess === secret) {
      const winnings = bet * 3;
      eco.users[senderID].balance += winnings;
      saveEconomy(DATA_DIR, eco);
      return api.sendMessage(
        `🎉 CORRECT! The number was ${secret}!\n+${winnings.toLocaleString()} coins (3x)\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
        threadID, messageID
      );
    } else {
      eco.users[senderID].balance -= bet;
      saveEconomy(DATA_DIR, eco);
      const hint = guess < secret ? '📈 Too low!' : '📉 Too high!';
      return api.sendMessage(
        `❌ Wrong! ${hint}\nThe number was ${secret}.\n-${bet.toLocaleString()} coins\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
        threadID, messageID
      );
    }
  }

  const bet = parseInt(args[0]);
  if (!bet || bet <= 0) return api.sendMessage("❌ Usage: !guess <bet>\nThen guess a number 1-100 to win 3x!", threadID, messageID);
  if (bet > eco.users[senderID].balance) {
    return api.sendMessage(`❌ Insufficient balance!\n💰 You have: ${eco.users[senderID].balance.toLocaleString()} coins`, threadID, messageID);
  }
  if (bet > 5000) return api.sendMessage("❌ Maximum bet is 5,000 coins.", threadID, messageID);

  const secret = Math.floor(Math.random() * 100) + 1;
  activeGames.set(gameKey, { secret, bet, startedAt: Date.now() });

  // Auto-expire after 60s
  setTimeout(() => {
    if (activeGames.get(gameKey)?.startedAt === activeGames.get(gameKey)?.startedAt) {
      activeGames.delete(gameKey);
    }
  }, 60000);

  return api.sendMessage(
    `🔢 Number Guessing Game!\n\nBet: ${bet.toLocaleString()} coins\n🎯 Win 3x your bet!\n\nI'm thinking of a number between 1-100.\nSend your guess now! (60s timeout)`,
    threadID, messageID
  );
};
