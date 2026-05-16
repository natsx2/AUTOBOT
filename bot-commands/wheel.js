const path = require('path');
const fs = require('fs');

function getEconomy(d) { try { return JSON.parse(fs.readFileSync(path.join(d,'economy.json'),'utf-8')); } catch { return {users:{}}; } }
function saveEconomy(d,e) { fs.writeFileSync(path.join(d,'economy.json'),JSON.stringify(e,null,2)); }

module.exports.config = {
  name: "wheel",
  aliases: ["spin", "fortune"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Spin the wheel of fortune for random multipliers",
  usage: "wheel <bet>",
  cooldowns: 8,
  category: "games"
};

// [multiplier, label, emoji, weight]
const SEGMENTS = [
  [0,    'BANKRUPT',  '💀', 20],
  [0.5,  '0.5x',     '😬', 18],
  [1.5,  '1.5x',     '👍', 22],
  [2,    '2x',       '✨', 18],
  [3,    '3x',       '🔥', 12],
  [5,    '5x',       '💎', 7],
  [10,   'JACKPOT',  '🎰', 3],
];

const TOTAL_WEIGHT = SEGMENTS.reduce((s, seg) => s + seg[3], 0);

function spinWheel() {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const seg of SEGMENTS) {
    rand -= seg[3];
    if (rand <= 0) return seg;
  }
  return SEGMENTS[0];
}

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;
  const eco = getEconomy(DATA_DIR);
  const user = eco.users[senderID];
  if (!user) return api.sendMessage('❌ Register first! Use !register', threadID, messageID);

  const bet = parseInt(args[0]);
  if (isNaN(bet) || bet < 10)
    return api.sendMessage(
      '🎡 Wheel of Fortune\n\nSpin for a random multiplier!\n\nUsage: !wheel <bet>\nExample: !wheel 200\n\n💎 Segments:\n💀 BANKRUPT (×0)\n😬 ×0.5\n👍 ×1.5\n✨ ×2\n🔥 ×3\n💎 ×5\n🎰 JACKPOT ×10',
      threadID, messageID
    );
  if (bet > user.balance)
    return api.sendMessage(`❌ Not enough coins. Balance: ${user.balance.toLocaleString()} coins`, threadID, messageID);
  if (bet > 10000)
    return api.sendMessage('❌ Maximum bet is 10,000 coins.', threadID, messageID);

  const [mult, label, emoji] = spinWheel();
  const payout = Math.floor(bet * mult);
  const net = payout - bet;
  user.balance += net;
  saveEconomy(DATA_DIR, eco);

  const resultLine = net > 0
    ? `🎉 ${emoji} ${label}! You won ${payout.toLocaleString()} coins! (+${net.toLocaleString()})`
    : net < 0
      ? `${emoji} ${label}! You lost ${bet.toLocaleString()} coins.`
      : `${emoji} ${label}! Break even.`;

  return api.sendMessage(
    `🎡 Wheel of Fortune\n\n🌀 Spinning...\n\n${resultLine}\n💰 Balance: ${user.balance.toLocaleString()} coins`,
    threadID, messageID
  );
};
