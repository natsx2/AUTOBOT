const path = require('path');
const fs = require('fs');
const http = require('http');

const pendingSessions = new Map();

function callAPI(port, method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: port || parseInt(process.env.PORT) || 8080,
      path: endpoint,
      method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ success: false }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports.config = {
  name: "addcmd",
  aliases: ["addcommand", "newcmd"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Add a custom command (admin only). Paste code after the command.",
  usage: "addcmd - then paste the command code",
  cooldowns: 10,
  category: "admin"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  const sessionKey = `addcmd_${senderID}_${threadID}`;
  const existing = pendingSessions.get(sessionKey);

  if (existing) {
    // User is pasting code
    const code = event.body.trim();
    pendingSessions.delete(sessionKey);

    // Basic structure validation
    if (!code.includes('module.exports.config') && !code.includes('exports.config')) {
      return api.sendMessage(
        "❌ Invalid command structure!\n\nMust include:\n- module.exports.config = { name, description, ... }\n- module.exports.run = async function(...) { ... }",
        threadID, messageID
      );
    }
    if (!code.includes('module.exports.run') && !code.includes('module.exports.handleEvent') &&
        !code.includes('exports.run') && !code.includes('exports.handleEvent')) {
      return api.sendMessage(
        "❌ Invalid command structure!\n\nMust export:\n- module.exports.run = async function({ api, event, args }) {}\n  OR\n- module.exports.handleEvent = async function({ api, event }) {}",
        threadID, messageID
      );
    }

    // Extract command name from code
    const nameMatch = code.match(/name\s*:\s*["']([^"']+)["']/);
    if (!nameMatch) {
      return api.sendMessage("❌ Command config must have a 'name' field.", threadID, messageID);
    }

    // Save to custom commands dir
    const CUSTOM_DIR = path.join(DATA_DIR, 'commands');
    fs.mkdirSync(CUSTOM_DIR, { recursive: true });
    const cmdName = nameMatch[1];
    const filePath = path.join(CUSTOM_DIR, `${cmdName}.js`);
    fs.writeFileSync(filePath, code);

    // Notify via API to reload commands
    try {
      const port = parseInt(process.env.PORT) || 8080;
      await callAPI(port, 'POST', '/api/bot/commands/reload', {});
    } catch {}

    return api.sendMessage(
      `✅ Command "${cmdName}" added successfully!\n\nUse !help to see it in the list.\nUse !removecmd ${cmdName} to remove it.`,
      threadID, messageID
    );
  }

  // Start session to collect code
  pendingSessions.set(sessionKey, { started: Date.now() });
  setTimeout(() => pendingSessions.delete(sessionKey), 120000); // 2min timeout

  return api.sendMessage(
    "📝 Add Custom Command\n\nPaste your command code now (within 2 minutes).\n\nRequired structure:\n```\nmodule.exports.config = {\n  name: 'cmdname',\n  description: '...',\n  role: 0,\n  hasPrefix: true,\n  cooldowns: 5,\n};\nmodule.exports.run = async function({ api, event, args }) {\n  api.sendMessage('Hello!', event.threadID);\n};\n```",
    threadID, messageID
  );
};

module.exports.handleEvent = async function({ api, event, DATA_DIR }) {
  if (!event.body) return;
  const { threadID, senderID } = event;
  const sessionKey = `addcmd_${senderID}_${threadID}`;
  if (!pendingSessions.has(sessionKey)) return;

  const code = event.body.trim();
  if (!code.includes('module.exports') && !code.includes('exports.')) return;

  pendingSessions.delete(sessionKey);

  if (!code.includes('module.exports.config') && !code.includes('exports.config')) {
    return api.sendMessage("❌ Invalid structure! Missing module.exports.config", threadID);
  }
  if (!code.includes('module.exports.run') && !code.includes('module.exports.handleEvent') &&
      !code.includes('exports.run') && !code.includes('exports.handleEvent')) {
    return api.sendMessage("❌ Invalid structure! Missing module.exports.run or handleEvent", threadID);
  }

  const nameMatch = code.match(/name\s*:\s*["']([^"']+)["']/);
  if (!nameMatch) {
    return api.sendMessage("❌ Command config must have a 'name' field.", threadID);
  }

  const botDataDir = DATA_DIR || path.join(process.cwd(), 'bot-data');
  const CUSTOM_DIR = path.join(botDataDir, 'commands');
  fs.mkdirSync(CUSTOM_DIR, { recursive: true });
  const cmdName = nameMatch[1];
  const filePath = path.join(CUSTOM_DIR, `${cmdName}.js`);
  fs.writeFileSync(filePath, code);

  try {
    const port = parseInt(process.env.PORT) || 8080;
    await callAPI(port, 'POST', '/api/bot/commands/reload', {});
  } catch {}

  return api.sendMessage(
    `✅ Command "${cmdName}" added!\nUse !help to see all commands.`,
    threadID
  );
};
