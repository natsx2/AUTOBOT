const path = require('path');
const fs = require('fs');

function getEconomy(d) { try { return JSON.parse(fs.readFileSync(path.join(d,'economy.json'),'utf-8')); } catch { return {users:{}}; } }
function saveEconomy(d,e) { fs.writeFileSync(path.join(d,'economy.json'),JSON.stringify(e,null,2)); }
function getLottery(d) { try { return JSON.parse(fs.readFileSync(path.join(d,'lottery.json'),'utf-8')); } catch { return {pot:0,jackpot:0,tickets:{},lastDraw:null}; } }
function saveLottery(d,l) { fs.mkdirSync(d,{recursive:true}); fs.writeFileSync(path.join(d,'lottery.json'),JSON.stringify(l,null,2)); }

const TICKET_PRICE = 10;
const MAX_TICKETS_PER_BUY = 20;

module.exports.config = {
  name: "lottery",
  aliases: ["lotto", "ticket"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Buy lottery tickets! Winner drawn every hour. 70% pot prize.",
  usage: "lottery <count> | lottery check | lottery jackpot",
  cooldowns: 5,
  category: "games"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;
  const eco = getEconomy(DATA_DIR);
  const user = eco.users[senderID];
  if (!user) return api.sendMessage('❌ Register first! Use !register', threadID, messageID);

  const lotto = getLottery(DATA_DIR);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'check') {
    const myTickets = lotto.tickets[senderID]?.count || 0;
    const totalTickets = Object.values(lotto.tickets).reduce((s, t) => s + t.count, 0);
    const chance = totalTickets > 0 ? ((myTickets / totalTickets) * 100).toFixed(1) : '0.0';
    return api.sendMessage(
      `🎫 Lottery Status\n\n💰 Current Pot: ${lotto.pot.toLocaleString()} coins\n🏆 Jackpot: ${lotto.jackpot.toLocaleString()} coins\n\n🎟 Your tickets: ${myTickets}\n📊 Total tickets: ${totalTickets}\n🎯 Win chance: ${chance}%\n\n💡 Buy more: !lottery <count> (${TICKET_PRICE} coins each)\n⏰ Draw: every hour`,
      threadID, messageID
    );
  }

  if (sub === 'jackpot') {
    return api.sendMessage(
      `🏆 Lottery Jackpot\n\n💎 Current Jackpot: ${lotto.jackpot.toLocaleString()} coins\n\nThe jackpot grows every round by 30% of the pot!\nBuy tickets with !lottery <count>`,
      threadID, messageID
    );
  }

  const count = parseInt(args[0]);
  if (isNaN(count) || count < 1)
    return api.sendMessage(
      `🎫 Lottery!\n\n💰 Current Pot: ${lotto.pot.toLocaleString()} coins\n🏆 Jackpot: ${lotto.jackpot.toLocaleString()} coins\n\nBuy tickets and win 70% of the pot!\nDrawn every hour automatically.\n\nUsage: !lottery <count>\nPrice: ${TICKET_PRICE} coins/ticket\nMax: ${MAX_TICKETS_PER_BUY} per purchase\n\n!lottery check — see your tickets\n!lottery jackpot — see jackpot`,
      threadID, messageID
    );
  if (count > MAX_TICKETS_PER_BUY)
    return api.sendMessage(`❌ Max ${MAX_TICKETS_PER_BUY} tickets per purchase.`, threadID, messageID);

  const cost = count * TICKET_PRICE;
  if (cost > user.balance)
    return api.sendMessage(`❌ Need ${cost.toLocaleString()} coins for ${count} tickets. Your balance: ${user.balance.toLocaleString()}`, threadID, messageID);

  user.balance -= cost;
  lotto.pot += cost;
  if (!lotto.tickets[senderID]) lotto.tickets[senderID] = { name: user.name, count: 0 };
  lotto.tickets[senderID].count += count;
  lotto.tickets[senderID].name = user.name;

  saveEconomy(DATA_DIR, eco);
  saveLottery(DATA_DIR, lotto);

  const myTotal = lotto.tickets[senderID].count;
  const totalAll = Object.values(lotto.tickets).reduce((s, t) => s + t.count, 0);
  const chance = ((myTotal / totalAll) * 100).toFixed(1);

  return api.sendMessage(
    `🎫 Lottery Tickets Purchased!\n\n✅ Bought ${count} ticket${count > 1 ? 's' : ''} for ${cost.toLocaleString()} coins\n🎟 Your total tickets: ${myTotal}\n💰 Current pot: ${lotto.pot.toLocaleString()} coins\n🎯 Win chance: ${chance}%\n\n⏰ Next draw: in under 1 hour\n💰 Balance: ${user.balance.toLocaleString()} coins`,
    threadID, messageID
  );
};
