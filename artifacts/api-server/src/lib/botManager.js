// Bot Manager - Pure JavaScript ES Module (ws3-fca integration)
// Manages Facebook bot sessions, commands, and FCA connections.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve workspace root relative to __dirname (dist/ -> api-server/ -> artifacts/ -> workspace/)
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(WORKSPACE_ROOT, 'bot-data');
const SESSION_DIR = path.join(DATA_DIR, 'session');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const COMMANDS_DIR = path.join(WORKSPACE_ROOT, 'bot-commands');

const Utils = {
  commands: new Map(),
  handleEvent: new Map(),
  account: new Map(),
  cooldowns: new Map(),
};

// Load commands immediately on module init so they always show in the dashboard
// even before any bot has logged in (same behaviour as original auto.js)
(function initCommands() {
  try {
    if (!fs.existsSync(COMMANDS_DIR)) {
      fs.mkdirSync(COMMANDS_DIR, { recursive: true });
      return;
    }
    const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));
    files.forEach(file => {
      try {
        const filePath = path.join(COMMANDS_DIR, file);
        delete require.cache[require.resolve(filePath)];
        const mod = require(filePath);
        if (!mod.config) return;
        const cfg = mod.config;
        const name = cfg.name || file.replace('.js', '');
        const aliases = Array.isArray(cfg.aliases) ? [...cfg.aliases, name] : [name];
        if (mod.run) {
          Utils.commands.set(aliases, {
            name, role: cfg.role || cfg.permission || 0, run: mod.run, aliases,
            description: cfg.description || '', usage: cfg.usage || cfg.usages || '',
            version: cfg.version || '1.0.0', hasPrefix: cfg.hasPrefix !== false && cfg.prefix !== false,
            credits: cfg.credits || '', cooldown: cfg.cooldown || cfg.cooldowns || 5, dev: cfg.dev || false,
            category: cfg.category || 'general',
          });
        }
        if (mod.handleEvent) {
          Utils.handleEvent.set(aliases, {
            name, handleEvent: mod.handleEvent, role: cfg.role || cfg.permission || 0,
            description: cfg.description || '', usage: cfg.usage || cfg.usages || '',
            version: cfg.version || '1.0.0', hasPrefix: cfg.hasPrefix !== false && cfg.prefix !== false,
            credits: cfg.credits || '', cooldown: cfg.cooldown || cfg.cooldowns || 5,
            category: cfg.category || 'general',
          });
        }
      } catch (err) {
        console.error(`[BotManager] Failed to load command ${file} on init:`, err.message);
      }
    });
    console.log(`[BotManager] Loaded ${Utils.commands.size} commands, ${Utils.handleEvent.size} event handlers on startup`);
  } catch (err) {
    console.error('[BotManager] Command init error:', err.message);
  }
}());

// Ensure data directories exist
function ensureDirs() {
  [DATA_DIR, SESSION_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
}

// Load commands from commands directory
export function loadCommands() {
  if (!fs.existsSync(COMMANDS_DIR)) {
    fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    return;
  }
  Utils.commands.clear();
  Utils.handleEvent.clear();
  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));
  files.forEach(file => {
    try {
      const filePath = path.join(COMMANDS_DIR, file);
      // Clear require cache for hot-reload
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      if (!mod.config) return;
      const cfg = mod.config;
      const name = cfg.name || file.replace('.js', '');
      const aliases = Array.isArray(cfg.aliases) ? [...cfg.aliases, name] : [name];
      if (mod.run) {
        Utils.commands.set(aliases, {
          name, role: cfg.role || 0, run: mod.run, aliases,
          description: cfg.description || '', usage: cfg.usage || '',
          version: cfg.version || '1.0.0', hasPrefix: cfg.hasPrefix !== false,
          credits: cfg.credits || '', cooldown: cfg.cooldown || 5, dev: cfg.dev || false,
        });
      }
      if (mod.handleEvent) {
        Utils.handleEvent.set(aliases, {
          name, handleEvent: mod.handleEvent, role: cfg.role || 0,
          description: cfg.description || '', usage: cfg.usage || '',
          version: cfg.version || '1.0.0', hasPrefix: cfg.hasPrefix !== false,
          credits: cfg.credits || '', cooldown: cfg.cooldown || 5,
        });
      }
    } catch (err) {
      console.error(`[BotManager] Failed to load command ${file}:`, err.message);
    }
  });
}

function findCommand(command) {
  if (!command) return null;
  const found = Array.from(Utils.commands.entries()).find(([cmds]) =>
    cmds.includes(command.toLowerCase())
  );
  return found ? found[1] : null;
}

function getHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch { return []; }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addUserToHistory(userid, prefix, admin, enableCommands, state) {
  const sessionFile = path.join(SESSION_DIR, `${userid}.json`);
  if (fs.existsSync(sessionFile)) return;
  const history = getHistory();
  history.push({ userid, prefix: prefix || '!', admin: admin || [], blacklist: [], enableCommands, time: 0 });
  saveHistory(history);
  fs.writeFileSync(sessionFile, JSON.stringify(state));
}

function removeUserFromHistory(userid) {
  const history = getHistory();
  const idx = history.findIndex(u => u.userid === userid);
  if (idx !== -1) history.splice(idx, 1);
  saveHistory(history);
  const sessionFile = path.join(SESSION_DIR, `${userid}.json`);
  try { if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile); } catch {}
}

export async function loginAccount(state, prefix, admin, enableCommands) {
  ensureDirs();
  loadCommands();

  let login;
  try {
    login = require('ws3-fca');
  } catch {
    throw new Error('ws3-fca not installed. Install it in the bot-data folder or project root.');
  }

  return new Promise((resolve, reject) => {
    login({ appState: state }, async (error, api) => {
      if (error) {
        reject(new Error(typeof error === 'string' ? error : error.message || JSON.stringify(error)));
        return;
      }

      const userid = api.getCurrentUserID();

      if (Utils.account.get(userid)) {
        reject(new Error('Account already logged in'));
        return;
      }

      // Validate account is not locked/suspended
      let userInfo;
      try {
        userInfo = await api.getUserInfo(userid);
        if (!userInfo || !userInfo[userid]?.name) {
          throw new Error('Account appears to be suspended or locked. Please check your account status.');
        }
      } catch (err) {
        reject(err);
        return;
      }

      const { name, profileUrl, thumbSrc } = userInfo[userid];

      // FCA options - robust settings to avoid disconnection
      api.setOptions({
        listenEvents: true,
        logLevel: 'silent',
        updatePresence: false,
        selfListen: false,
        forceLogin: true,
        online: true,
        autoMarkDelivery: false,
        autoMarkRead: false,
      });

      // Track online time - restore from history
      const history = getHistory();
      const savedTime = (history.find(u => u.userid === userid) || {}).time || 0;
      Utils.account.set(userid, { name, profileUrl, thumbSrc, prefix, time: savedTime, online: true });

      const intervalId = setInterval(() => {
        const account = Utils.account.get(userid);
        if (!account) { clearInterval(intervalId); return; }
        Utils.account.set(userid, { ...account, time: account.time + 1 });
      }, 1000);

      addUserToHistory(userid, prefix, admin, enableCommands, state);

      // Start listening with automatic error handling
      const startListening = () => {
        try {
          api.listenMqtt(async (err, event) => {
            if (err) {
              if (err === 'Connection closed.' || err?.error === 'Connection closed.') {
                console.log(`[BotManager] Connection closed for ${userid}, session preserved.`);
                return;
              }
              return;
            }

            if (!event) return;

            // Handle event listeners
            for (const { handleEvent, name } of Utils.handleEvent.values()) {
              if (handleEvent && name) {
                const allCommands = (enableCommands[0]?.commands || []);
                const allEvents = (enableCommands[1]?.handleEvent || []);
                if (allCommands.includes(name) || allEvents.includes(name)) {
                  try { handleEvent({ api, event, prefix, admin }); } catch {}
                }
              }
            }

            // Handle prefix commands
            if (event.body && event.body.toLowerCase().startsWith((prefix || '!').toLowerCase())) {
              const [rawCmd, ...args] = event.body.trim().substring((prefix || '!').length).trim().split(/\s+/);
              const cmd = findCommand(rawCmd?.toLowerCase());
              if (!cmd) return;

              const isAdmin = admin.includes(event.senderID);
              if (Number(cmd.role) >= 1 && !isAdmin) {
                api.sendMessage("You don't have permission to use this command.", event.threadID, event.messageID);
                return;
              }

              const enabled = enableCommands[0]?.commands || [];
              if (enabled.includes(cmd.name)) {
                const now = Date.now();
                const cooldownKey = `${event.senderID}_${cmd.name}_${userid}`;
                const lastUse = Utils.cooldowns.get(cooldownKey);
                const delay = (cmd.cooldown || 5) * 1000;
                if (lastUse && (now - lastUse.timestamp) < delay) {
                  const remaining = Math.ceil((lastUse.timestamp + delay - now) / 1000);
                  api.sendMessage(`Please wait ${remaining}s before using "${cmd.name}" again.`, event.threadID, event.messageID);
                  return;
                }
                Utils.cooldowns.set(cooldownKey, { timestamp: now, command: cmd.name });
                try {
                  await cmd.run({ api, event, args, prefix, admin, Utils });
                } catch (runErr) {
                  console.error(`[BotManager] Command "${cmd.name}" error:`, runErr?.message);
                }
              }
            }
          });
        } catch (listenErr) {
          console.error(`[BotManager] Listen error for ${userid}:`, listenErr?.message);
        }
      };

      startListening();

      // Keep-alive: save uptime every 60 seconds to persist across restarts
      const saveUptimeId = setInterval(() => {
        const account = Utils.account.get(userid);
        if (!account) { clearInterval(saveUptimeId); return; }
        const h = getHistory();
        const userIdx = h.findIndex(u => u.userid === userid);
        if (userIdx !== -1) {
          h[userIdx].time = account.time;
          saveHistory(h);
        }
      }, 60 * 1000);

      // Keep session alive with lightweight API call every 5 minutes
      const keepAliveId = setInterval(async () => {
        const account = Utils.account.get(userid);
        if (!account) { clearInterval(keepAliveId); return; }
        try {
          await api.getUserInfo(userid).catch(() => {});
        } catch {}
      }, 5 * 60 * 1000);

      resolve({ userid, name, profileUrl, thumbSrc });
    });
  });
}

export async function logoutAccount(userid) {
  const account = Utils.account.get(userid);
  if (!account) throw new Error('Account not found');
  Utils.account.delete(userid);
  removeUserFromHistory(userid);
}

export function getAccounts() {
  return Array.from(Utils.account.entries()).map(([userid, data]) => ({
    userid,
    name: data.name,
    profileUrl: data.profileUrl || null,
    thumbSrc: data.thumbSrc || null,
    time: data.time,
    prefix: data.prefix || '!',
    online: data.online !== false,
  }));
}

export function getAccount(userid) {
  return Utils.account.get(userid) || null;
}

export function getCommands() {
  const seen = new Set();
  const commands = [];
  const handleEvent = [];
  const commandDetails = [];
  const handleEventDetails = [];

  for (const cmd of Utils.commands.values()) {
    if (!seen.has(cmd.name)) {
      seen.add(cmd.name);
      commands.push(cmd.name);
      commandDetails.push({
        name: cmd.name,
        description: cmd.description || '',
        usage: cmd.usage || '',
        credits: cmd.credits || '',
        role: cmd.role || 0,
        cooldown: cmd.cooldown || 5,
        aliases: (cmd.aliases || []).filter(a => a !== cmd.name),
        hasPrefix: cmd.hasPrefix !== false,
        version: cmd.version || '1.0.0',
        category: cmd.category || 'general',
        dev: cmd.dev || false,
      });
    }
  }
  for (const evt of Utils.handleEvent.values()) {
    if (!seen.has(evt.name)) {
      seen.add(evt.name);
      handleEvent.push(evt.name);
      handleEventDetails.push({
        name: evt.name,
        description: evt.description || '',
        usage: evt.usage || '',
        credits: evt.credits || '',
        role: evt.role || 0,
        cooldown: evt.cooldown || 5,
        hasPrefix: evt.hasPrefix !== false,
        version: evt.version || '1.0.0',
        category: evt.category || 'general',
      });
    }
  }
  return { commands, handleEvent, commandDetails, handleEventDetails };
}

// Auto-restore sessions on server startup
export async function restoreSessionsOnStartup() {
  ensureDirs();
  loadCommands();

  if (!fs.existsSync(SESSION_DIR)) return;
  const history = getHistory();
  const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const userid = path.parse(file).name;
    const userHistory = history.find(u => u.userid === userid);
    if (!userHistory) continue;
    try {
      const state = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8'));
      await loginAccount(state, userHistory.prefix, userHistory.admin, userHistory.enableCommands);
      console.log(`[BotManager] Restored session for ${userid} (${userHistory.prefix})`);
    } catch (err) {
      console.error(`[BotManager] Failed to restore session for ${userid}:`, err.message);
      removeUserFromHistory(userid);
    }
  }
}
