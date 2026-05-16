const path = require('path');
const fs = require('fs');

function getEconomy(d) { try { return JSON.parse(fs.readFileSync(path.join(d,'economy.json'),'utf-8')); } catch { return {users:{}}; } }
function saveEconomy(d,e) { fs.writeFileSync(path.join(d,'economy.json'),JSON.stringify(e,null,2)); }

module.exports.config = {
  name: "rps",
  aliases: ["rockpaperscissors", "roshambo"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Play Rock Paper Scissors vs the bot, win 2x your bet",
  usage: "rps rock|paper|scissors <bet>",
  cooldowns: 5,
  category: "games"
};

const CHOICES = ['rock', 'paper', 'scissors'];
const EMOJIS = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;
  const eco = getEconomy(DATA_DIR);
  const user = eco.users[senderID];
  if (!user) return api.sendMessage('❌ Register first! Use !register', threadID, messageID);

  const choice = (args[0] || '').toLowerCase();
  const bet = parseInt(args[1]);

  if (!CHOICES.includes(choice))
    return api.sendMessage('🪨📄✂️ Rock Paper Scissors\n\nUsage: !rps rock|paper|scissors <bet>\nExample: !rps rock 100\n\nWin 2x your bet!', threadID, messageID);
  if (isNaN(bet) || bet < 10)
    return api.sendMessage('❌ Minimum bet is 10 coins.', threadID, messageID);
  if (bet > user.balance)
    return api.sendMessage(`❌ Not enough coins. Balance: ${user.balance.toLocaleString()} coins`, threadID, messageID);
  if (bet > 5000)
    return api.sendMessage('❌ Maximum bet is 5,000 coins.', threadID, messageID);

  const botChoice = CHOICES[Math.floor(Math.random() * 3)];
  const playerEmoji = EMOJIS[choice];
  const botEmoji = EMOJIS[botChoice];

  let result, coins;
  if (choice === botChoice) {
    result = 'draw';
    coins = 0;
  } else if (BEATS[choice] === botChoice) {
    result = 'win';
    coins = bet;
    user.balance += bet;
  } else {
    result = 'lose';
    coins = -bet;
    user.balance -= bet;
  }
  if (result !== 'draw') saveEconomy(DATA_DIR, eco);

  const header = result === 'win' ? '🎉 YOU WIN!' : result === 'lose' ? '😞 YOU LOSE!' : '🤝 DRAW!';
  const coinMsg = result === 'draw' ? 'Bet returned' : result === 'win' ? `+${bet.toLocaleString()} coins` : `-${bet.toLocaleString()} coins`;

  return api.sendMessage(
    `🪨📄✂️ Rock Paper Scissors\n\nYou: ${playerEmoji} ${choice}\nBot: ${botEmoji} ${botChoice}\n\n${header}\n${coinMsg}\n💰 Balance: ${user.balance.toLocaleString()} coins`,
    threadID, messageID
  );
};
