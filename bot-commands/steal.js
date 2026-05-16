const path = require('path');
const fs = require('fs');

function getEconomy(d) { try { return JSON.parse(fs.readFileSync(path.join(d,'economy.json'),'utf-8')); } catch { return {users:{}}; } }
function saveEconomy(d,e) { fs.writeFileSync(path.join(d,'economy.json'),JSON.stringify(e,null,2)); }

module.exports.config = {
  name: "steal",
  aliases: ["rob", "heist"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Attempt to steal coins from another user (50% success rate, doubles on failure)",
  usage: "steal @user <amount>",
  cooldowns: 30,
  category: "games"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID, mentions } = event;
  const eco = getEconomy(DATA_DIR);
  const robber = eco.users[senderID];
  if (!robber) return api.sendMessage('❌ Register first! Use !register', threadID, messageID);

  const targetID = Object.keys(mentions || {})[0];
  if (!targetID)
    return api.sendMessage('🦹 Steal Command\n\nAttempt to steal coins from another user!\n• 50% success — steal the amount\n• 50% fail — YOU pay double to the victim\n\nUsage: !steal @user <amount>\nCooldown: 30 seconds', threadID, messageID);

  if (targetID === senderID)
    return api.sendMessage('❌ You cannot steal from yourself!', threadID, messageID);

  const victim = eco.users[targetID];
  if (!victim) return api.sendMessage('❌ That user is not registered.', threadID, messageID);

  const amount = parseInt(args.find(a => /^\d+$/.test(a)));
  if (isNaN(amount) || amount < 10)
    return api.sendMessage('❌ Minimum steal amount is 10 coins.', threadID, messageID);
  if (amount > robber.balance)
    return api.sendMessage(`❌ You don't have enough coins to risk. Balance: ${robber.balance.toLocaleString()}`, threadID, messageID);
  if (amount > victim.balance)
    return api.sendMessage(`❌ Target doesn't have that many coins. They have: ${victim.balance.toLocaleString()}`, threadID, messageID);
  if (amount > 5000)
    return api.sendMessage('❌ Maximum steal is 5,000 coins.', threadID, messageID);

  const success = Math.random() < 0.5;
  const victimName = victim.name || `User_${targetID}`;
  const robberName = robber.name || `User_${senderID}`;

  if (success) {
    robber.balance += amount;
    victim.balance -= amount;
    saveEconomy(DATA_DIR, eco);
    return api.sendMessage(
      `🦹 Steal Successful!\n\n🎉 ${robberName} stole ${amount.toLocaleString()} coins from ${victimName}!\n\n💰 Your balance: ${robber.balance.toLocaleString()} coins\n😢 ${victimName}'s balance: ${victim.balance.toLocaleString()} coins`,
      threadID, messageID
    );
  } else {
    const penalty = amount * 2;
    const actualPenalty = Math.min(penalty, robber.balance);
    robber.balance -= actualPenalty;
    victim.balance += actualPenalty;
    saveEconomy(DATA_DIR, eco);
    return api.sendMessage(
      `🚨 Caught Red-Handed!\n\n👮 ${robberName} got caught trying to steal from ${victimName}!\n💸 Paid ${actualPenalty.toLocaleString()} coins as penalty (×2)!\n\n💰 Your balance: ${robber.balance.toLocaleString()} coins\n🎁 ${victimName} received: ${actualPenalty.toLocaleString()} coins`,
      threadID, messageID
    );
  }
};
