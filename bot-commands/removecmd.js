const path = require('path');
const fs = require('fs');
const http = require('http');

function callAPI(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const port = parseInt(process.env.PORT) || 8080;
    const opts = {
      hostname: 'localhost',
      port,
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
  name: "removecmd",
  aliases: ["rmcmd", "delcmd", "deletecmd"],
  version: "1.0.0",
  role: 1,
  credits: "AutoBot",
  hasPrefix: true,
  description: "Remove a custom command (admin only)",
  usage: "removecmd <command name>",
  cooldowns: 10,
  category: "admin"
};

module.exports.run = async function({ api, event, args, DATA_DIR }) {
  const { threadID, messageID } = event;

  const name = args[0];
  if (!name) return api.sendMessage("❌ Usage: !removecmd <command name>", threadID, messageID);

  const botDataDir = DATA_DIR || path.join(process.cwd(), 'bot-data');
  const CUSTOM_DIR = path.join(botDataDir, 'commands');
  const filePath = path.join(CUSTOM_DIR, `${name}.js`);

  if (!fs.existsSync(filePath)) {
    // List available custom commands
    const files = fs.existsSync(CUSTOM_DIR)
      ? fs.readdirSync(CUSTOM_DIR).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''))
      : [];
    const listMsg = files.length ? `Available custom commands:\n${files.join(', ')}` : 'No custom commands found.';
    return api.sendMessage(`❌ Custom command "${name}" not found.\n\n${listMsg}`, threadID, messageID);
  }

  fs.unlinkSync(filePath);

  try {
    await callAPI('POST', '/api/bot/commands/reload', {});
  } catch {}

  return api.sendMessage(`✅ Command "${name}" removed successfully!`, threadID, messageID);
};
