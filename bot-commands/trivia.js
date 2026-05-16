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

const QUESTIONS = [
  { q: "What is the capital of France?", a: "paris", choices: ["London", "Berlin", "Paris", "Rome"] },
  { q: "How many sides does a hexagon have?", a: "6", choices: ["5", "6", "7", "8"] },
  { q: "What planet is known as the Red Planet?", a: "mars", choices: ["Venus", "Mars", "Jupiter", "Saturn"] },
  { q: "What is 12 × 12?", a: "144", choices: ["124", "132", "144", "156"] },
  { q: "Which element has the symbol 'O'?", a: "oxygen", choices: ["Gold", "Silver", "Oxygen", "Osmium"] },
  { q: "Who wrote Romeo and Juliet?", a: "shakespeare", choices: ["Dickens", "Shakespeare", "Tolkien", "Austen"] },
  { q: "What is the largest ocean on Earth?", a: "pacific", choices: ["Atlantic", "Indian", "Pacific", "Arctic"] },
  { q: "In what year did World War II end?", a: "1945", choices: ["1943", "1944", "1945", "1946"] },
  { q: "What is the square root of 144?", a: "12", choices: ["10", "11", "12", "13"] },
  { q: "How many continents are there?", a: "7", choices: ["5", "6", "7", "8"] },
  { q: "What is the fastest land animal?", a: "cheetah", choices: ["Lion", "Cheetah", "Leopard", "Horse"] },
  { q: "What color is the sky on a clear day?", a: "blue", choices: ["Green", "Blue", "Yellow", "Red"] },
  { q: "How many hours are in a day?", a: "24", choices: ["12", "18", "24", "36"] },
  { q: "What is the boiling point of water in Celsius?", a: "100", choices: ["50", "75", "100", "120"] },
  { q: "Which planet is closest to the Sun?", a: "mercury", choices: ["Venus", "Earth", "Mercury", "Mars"] },
];

const activeGames = new Map();

module.exports.config = {
  name: "trivia",
  aliases: ["quiz", "triv"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Answer trivia questions to win coins",
  usage: "trivia <bet>",
  cooldowns: 5,
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
    const ans = (args.join(' ') || '').toLowerCase().trim();
    const correct = existing.q.a.toLowerCase();

    activeGames.delete(gameKey);

    if (ans === correct || ans === correct.split(' ')[0]) {
      const winnings = existing.bet * 2;
      eco.users[senderID].balance += winnings;
      saveEconomy(DATA_DIR, eco);
      return api.sendMessage(
        `✅ CORRECT!\n\nAnswer: ${existing.q.choices.find(c => c.toLowerCase() === correct || c.toLowerCase().startsWith(correct))}\n+${winnings.toLocaleString()} coins (2x)\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
        threadID, messageID
      );
    } else {
      eco.users[senderID].balance -= existing.bet;
      saveEconomy(DATA_DIR, eco);
      return api.sendMessage(
        `❌ Wrong!\nCorrect answer: ${existing.q.choices.find(c => c.toLowerCase() === correct || c.toLowerCase().startsWith(correct))}\n-${existing.bet.toLocaleString()} coins\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
        threadID, messageID
      );
    }
  }

  const bet = parseInt(args[0]);
  if (!bet || bet <= 0) return api.sendMessage("❌ Usage: !trivia <bet>\nAnswer correctly to win 2x!", threadID, messageID);
  if (bet > eco.users[senderID].balance) {
    return api.sendMessage(`❌ Insufficient balance!\n💰 You have: ${eco.users[senderID].balance.toLocaleString()} coins`, threadID, messageID);
  }
  if (bet > 5000) return api.sendMessage("❌ Maximum bet is 5,000 coins.", threadID, messageID);

  const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
  activeGames.set(gameKey, { q, bet, startedAt: Date.now() });

  setTimeout(() => { activeGames.delete(gameKey); }, 30000);

  const choiceText = shuffled.map((c, i) => `${['A', 'B', 'C', 'D'][i]}. ${c}`).join('\n');
  return api.sendMessage(
    `🧠 Trivia!\n\nBet: ${bet.toLocaleString()} coins (win 2x)\n\n❓ ${q.q}\n\n${choiceText}\n\nType your answer! (30s timeout)`,
    threadID, messageID
  );
};
