const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: "autopost",
  aliases: ["randompost", "schedulepost"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Enable/disable automatic random posts in a group chat",
  usage: "autopost on | autopost off | autopost status | autopost now",
  cooldowns: 5,
  category: "admin"
};

function getAutopostData(dataDir) {
  const f = path.join(dataDir, 'autopost.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return { threads: [] }; }
}
function saveAutopostData(dataDir, data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'autopost.json'), JSON.stringify(data, null, 2));
}

const randomPosts = [
  '🎮 Game time! Who wants to play? Drop a 🙋 if you\'re in!',
  '🌟 Fact of the day: The average person laughs 15 times a day. Let\'s make it 16! 😂',
  '☕ Good vibes only in this group! How\'s everyone doing today? 😊',
  '🎵 Music mood: What song is stuck in your head right now? Drop it! 🎶',
  '🤔 Question of the day: If you could travel anywhere right now, where would you go?',
  '💡 Life tip: Drink more water, sleep enough, and never stop learning! 📚',
  '🎲 Fun fact: Honey never expires. They found 3000-year-old honey in Egyptian tombs and it was still edible! 🍯',
  '🌈 Random reminder: You are doing better than you think you are! Keep going! 💪',
  '🎯 Challenge: Send one kind message to someone today. Spread positivity! 💖',
  '📸 Share a photo that made you smile recently! 😄',
  '🍕 Important question: Pineapple on pizza — yes or no? Vote now! 🗳️',
  '🌙 Evening thought: What was the best part of your day today? Share below! ⬇️',
  '🦋 Nature fact: Butterflies taste with their feet! 🐛➡️🦋',
  '🎪 This or that: Mountains or Beach? Comment your choice! 🏔️🏖️',
  '💪 Motivation boost: Every expert was once a beginner. Keep pushing forward! 🚀',
  '🤣 Joke time: Why don\'t scientists trust atoms? Because they make up everything! 😆',
  '🌺 Appreciation post: Drop a ❤️ if this group chat brings you joy!',
  '🎊 Weekend vibes: What are your plans this weekend? 🗓️',
  '🍜 Foodie question: What\'s your favorite comfort food? 🍽️',
  '🌟 Inspirational: "The best time to plant a tree was 20 years ago. The second best time is now." 🌳',
];

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID } = event;
  const sub = (args[0] || '').toLowerCase();

  const data = getAutopostData(DATA_DIR);
  const threads = data.threads || [];
  const isEnabled = threads.includes(threadID);

  if (sub === 'now') {
    const post = randomPosts[Math.floor(Math.random() * randomPosts.length)];
    return api.sendMessage(post, threadID, messageID);
  }

  if (!sub || sub === 'status') {
    return api.sendMessage(
      `📢 Auto-Post Status:\n\n${isEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n\nSchedule: Every 2 hours (random)\n\nCommands:\n• !autopost on — Enable\n• !autopost off — Disable\n• !autopost now — Post immediately`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (isEnabled) return api.sendMessage('✅ Auto-post already enabled!', threadID, messageID);
    threads.push(threadID);
    saveAutopostData(DATA_DIR, { threads });
    return api.sendMessage('✅ Auto-post enabled! Random posts will be sent every 2 hours.', threadID, messageID);
  }

  if (sub === 'off') {
    if (!isEnabled) return api.sendMessage('❌ Auto-post already disabled.', threadID, messageID);
    const updated = threads.filter(t => t !== threadID);
    saveAutopostData(DATA_DIR, { threads: updated });
    return api.sendMessage('✅ Auto-post disabled for this group.', threadID, messageID);
  }

  return api.sendMessage('❓ Usage: !autopost on | off | status | now', threadID, messageID);
};
