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

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const v of VALUES) deck.push(`${v}${s}`);
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  const v = card.slice(0, -1);
  if (['J', 'Q', 'K'].includes(v)) return 10;
  if (v === 'A') return 11;
  return parseInt(v);
}

function handValue(hand) {
  let val = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.startsWith('A')).length;
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}

const activeGames = new Map();

module.exports.config = {
  name: "blackjack",
  aliases: ["bj", "21"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Play Blackjack! Get closer to 21 than the dealer.",
  usage: "blackjack <bet> | blackjack hit | blackjack stand",
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
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'hit' || sub === 'h') {
    const game = activeGames.get(gameKey);
    if (!game) return api.sendMessage("❌ No active game. Use !blackjack <bet> to start.", threadID, messageID);

    game.player.push(game.deck.pop());
    const pVal = handValue(game.player);

    if (pVal > 21) {
      activeGames.delete(gameKey);
      eco.users[senderID].balance -= game.bet;
      saveEconomy(DATA_DIR, eco);
      return api.sendMessage(
        `🃏 Blackjack\n\nYour hand: ${game.player.join(' ')} (${pVal})\nDealer: ${game.dealer[0]} ??\n\n💥 BUST! You went over 21.\n-${game.bet.toLocaleString()} coins\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
        threadID, messageID
      );
    }

    return api.sendMessage(
      `🃏 Blackjack\n\nYour hand: ${game.player.join(' ')} (${pVal})\nDealer: ${game.dealer[0]} ??\n\nType !bj hit or !bj stand`,
      threadID, messageID
    );
  }

  if (sub === 'stand' || sub === 's') {
    const game = activeGames.get(gameKey);
    if (!game) return api.sendMessage("❌ No active game. Use !blackjack <bet> to start.", threadID, messageID);

    activeGames.delete(gameKey);

    while (handValue(game.dealer) < 17) game.dealer.push(game.deck.pop());

    const pVal = handValue(game.player);
    const dVal = handValue(game.dealer);

    let result;
    if (dVal > 21 || pVal > dVal) {
      eco.users[senderID].balance += game.bet;
      result = `✅ YOU WIN! +${game.bet.toLocaleString()} coins`;
    } else if (pVal === dVal) {
      result = `🤝 PUSH! No coins lost`;
    } else {
      eco.users[senderID].balance -= game.bet;
      result = `❌ DEALER WINS! -${game.bet.toLocaleString()} coins`;
    }
    saveEconomy(DATA_DIR, eco);

    return api.sendMessage(
      `🃏 Blackjack Result\n\nYour hand: ${game.player.join(' ')} (${pVal})\nDealer: ${game.dealer.join(' ')} (${dVal})\n\n${result}\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
      threadID, messageID
    );
  }

  // Start new game
  if (activeGames.has(gameKey)) {
    const game = activeGames.get(gameKey);
    const pVal = handValue(game.player);
    return api.sendMessage(
      `🃏 You have an active game!\n\nYour hand: ${game.player.join(' ')} (${pVal})\nDealer: ${game.dealer[0]} ??\n\nType !bj hit or !bj stand`,
      threadID, messageID
    );
  }

  const bet = parseInt(args[0]);
  if (!bet || bet <= 0) return api.sendMessage("❌ Usage: !blackjack <bet>\nThen: !bj hit or !bj stand", threadID, messageID);
  if (bet > eco.users[senderID].balance) {
    return api.sendMessage(`❌ Insufficient balance!\n💰 You have: ${eco.users[senderID].balance.toLocaleString()} coins`, threadID, messageID);
  }
  if (bet > 10000) return api.sendMessage("❌ Maximum bet is 10,000 coins.", threadID, messageID);

  const deck = createDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  const pVal = handValue(player);

  activeGames.set(gameKey, { deck, player, dealer, bet });

  // Check instant blackjack
  if (pVal === 21) {
    activeGames.delete(gameKey);
    const winnings = Math.floor(bet * 1.5);
    eco.users[senderID].balance += winnings;
    saveEconomy(DATA_DIR, eco);
    return api.sendMessage(
      `🃏 BLACKJACK!\n\nYour hand: ${player.join(' ')} (21)\n\n🎉 Blackjack! +${winnings.toLocaleString()} coins (1.5x)\n💰 Balance: ${eco.users[senderID].balance.toLocaleString()} coins`,
      threadID, messageID
    );
  }

  return api.sendMessage(
    `🃏 Blackjack!\n\nBet: ${bet.toLocaleString()} coins\n\nYour hand: ${player.join(' ')} (${pVal})\nDealer: ${dealer[0]} ??\n\nType !bj hit or !bj stand`,
    threadID, messageID
  );
};
