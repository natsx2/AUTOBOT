const path = require('path');
const fs = require('fs');

function getEconomy(d) { try { return JSON.parse(fs.readFileSync(path.join(d,'economy.json'),'utf-8')); } catch { return {users:{}}; } }
function saveEconomy(d,e) { fs.writeFileSync(path.join(d,'economy.json'),JSON.stringify(e,null,2)); }

module.exports.config = {
  name: "dice",
  aliases: ["roll", "rolldice"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Guess the dice roll (1-6) and win 5x your bet",
  usage: "dice <1-6> <bet>",
  cooldowns: 5,
  category: "games"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;
  const eco = getEconomy(DATA_DIR);
  const user = eco.users[senderID];
  if (!user) return api.sendMessage('❌ You need to register first! Use !register', threadID, messageID);

  const guess = parseInt(args[0]);
  const bet = parseInt(args[1]);

  if (isNaN(guess) || guess < 1 || guess > 6)
    return api.sendMessage('🎲 Dice Game\n\nGuess the dice roll (1-6) and win 5x your bet!\n\nUsage: !dice <1-6> <bet>\nExample: !dice 4 100', threadID, messageID);
  if (isNaN(bet) || bet < 10)
    return api.sendMessage('❌ Minimum bet is 10 coins.', threadID, messageID);
  if (bet > user.balance)
    return api.sendMessage(`❌ Not enough coins. Your balance: ${user.balance.toLocaleString()} coins`, threadID, messageID);
  if (bet > 5000)
    return api.sendMessage('❌ Maximum bet is 5,000 coins.', threadID, messageID);

  const roll = Math.floor(Math.random() * 6) + 1;
  const faces = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
  const win = roll === guess;

  if (win) {
    const prize = bet * 5;
    user.balance += prize - bet;
    saveEconomy(DATA_DIR, eco);
    return api.sendMessage(
      `🎲 Dice Roll!\n\n${faces[roll]} Rolled: ${roll}\n🎯 Your guess: ${guess}\n\n🎉 CORRECT! You win ${prize.toLocaleString()} coins! (5x)\n💰 Balance: ${user.balance.toLocaleString()} coins`,
      threadID, messageID
    );
  } else {
    user.balance -= bet;
    saveEconomy(DATA_DIR, eco);
    return api.sendMessage(
      `🎲 Dice Roll!\n\n${faces[roll]} Rolled: ${roll}\n🎯 Your guess: ${guess}\n\n❌ Wrong! You lost ${bet.toLocaleString()} coins.\n💰 Balance: ${user.balance.toLocaleString()} coins`,
      threadID, messageID
    );
  }
};
