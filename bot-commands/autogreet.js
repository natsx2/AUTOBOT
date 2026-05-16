const path = require('path');
const fs = require('fs');

function getGreetData(dataDir) {
  const f = path.join(dataDir, 'greet.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return { threads: [] }; }
}
function saveGreetData(dataDir, data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'greet.json'), JSON.stringify(data, null, 2));
}

module.exports.config = {
  name: "autogreet",
  aliases: ["greetings", "autohello"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Enable or disable automatic good morning/good night greetings in this group",
  usage: "autogreet on | autogreet off | autogreet status",
  cooldowns: 5,
  category: "admin"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID } = event;
  const sub = (args[0] || '').toLowerCase();

  const greetData = getGreetData(DATA_DIR);
  const threads = greetData.threads || [];
  const isEnabled = threads.includes(threadID);

  if (!sub || sub === 'status') {
    return api.sendMessage(
      `🌅 Auto-Greet Status for this group:\n\n${isEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n📋 Schedule (PHT):\n• ☀️ Good Morning — 6:00 AM\n• 🌙 Good Night — 9:00 PM\n\nCommands:\n• !autogreet on — Enable\n• !autogreet off — Disable`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (isEnabled) {
      return api.sendMessage('✅ Auto-greet is already enabled in this group!', threadID, messageID);
    }
    threads.push(threadID);
    saveGreetData(DATA_DIR, { threads });
    return api.sendMessage(
      '✅ Auto-greet enabled!\n\n🌅 The bot will send:\n• ☀️ Good Morning at 6:00 AM (PHT)\n• 🌙 Good Night at 9:00 PM (PHT)\n\nEvery day automatically!',
      threadID, messageID
    );
  }

  if (sub === 'off') {
    if (!isEnabled) {
      return api.sendMessage('❌ Auto-greet is already disabled in this group.', threadID, messageID);
    }
    const updated = threads.filter(t => t !== threadID);
    saveGreetData(DATA_DIR, { threads: updated });
    return api.sendMessage('✅ Auto-greet disabled for this group.', threadID, messageID);
  }

  return api.sendMessage('❓ Usage: !autogreet on | !autogreet off | !autogreet status', threadID, messageID);
};
