// Bot Manager - Pure JavaScript ES Module (ws3-fca integration)
// Manages Facebook bot sessions, commands, and FCA connections.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve workspace root relative to __dirname
// In dev: src/lib/ -> src/ -> api-server/ -> artifacts/ -> workspace/
// In prod (dist/): dist/ -> api-server/ -> artifacts/ -> workspace/
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(WORKSPACE_ROOT, 'bot-data');
const SESSION_DIR = path.join(DATA_DIR, 'session');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const COMMANDS_DIR = path.join(WORKSPACE_ROOT, 'bot-commands');
const CUSTOM_COMMANDS_DIR = path.join(DATA_DIR, 'commands'); // user-added commands (persisted)

const Utils = {
  commands: new Map(),
  handleEvent: new Map(),
  account: new Map(),
  cooldowns: new Map(),
};

function loadSingleCommand(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    const mod = require(filePath);
    if (!mod.config) return null;
    const cfg = mod.config;
    const name = cfg.name || path.basename(filePath, '.js');
    const aliases = Array.isArray(cfg.aliases) ? [...cfg.aliases, name] : [name];
    const base = {
      name, aliases,
      description: cfg.description || '',
      usage: cfg.usage || cfg.usages || '',
      version: cfg.version || '1.0.0',
      hasPrefix: cfg.hasPrefix !== false && cfg.prefix !== false,
      credits: cfg.credits || '',
      cooldown: cfg.cooldown || cfg.cooldowns || 5,
      dev: cfg.dev || false,
      category: cfg.category || 'general',
      role: cfg.role || cfg.permission || 0,
    };
    if (mod.run) {
      Utils.commands.set(aliases, { ...base, run: mod.run });
    }
    if (mod.handleEvent) {
      Utils.handleEvent.set(aliases, { ...base, handleEvent: mod.handleEvent });
    }
    return name;
  } catch (err) {
    console.error(`[BotManager] Failed to load ${filePath}:`, err.message);
    return null;
  }
}

function loadCommandsFromDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  files.forEach(file => loadSingleCommand(path.join(dir, file)));
}

// Load all commands (both static and custom)
export function loadCommands() {
  Utils.commands.clear();
  Utils.handleEvent.clear();
  [COMMANDS_DIR, CUSTOM_COMMANDS_DIR].forEach(dir => {
    if (fs.existsSync(dir)) loadCommandsFromDir(dir);
  });
  console.log(`[BotManager] Loaded ${Utils.commands.size} commands, ${Utils.handleEvent.size} event handlers`);
}

// Load commands immediately on module init
(function initCommands() {
  try {
    [COMMANDS_DIR, CUSTOM_COMMANDS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
    loadCommandsFromDir(COMMANDS_DIR);
    loadCommandsFromDir(CUSTOM_COMMANDS_DIR);
    console.log(`[BotManager] Loaded ${Utils.commands.size} commands, ${Utils.handleEvent.size} event handlers on startup`);
  } catch (err) {
    console.error('[BotManager] Command init error:', err.message);
  }
}());

// Ensure data directories exist
function ensureDirs() {
  [DATA_DIR, SESSION_DIR, CUSTOM_COMMANDS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
}

function findCommand(command) {
  if (!command) return null;
  const lc = command.toLowerCase();
  const found = Array.from(Utils.commands.entries()).find(([cmds]) =>
    cmds.some(c => c.toLowerCase() === lc)
  );
  return found ? found[1] : null;
}

function getHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch { return []; }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('[BotManager] Failed to save history:', err.message);
  }
}

function addUserToHistory(userid, prefix, admin, enableCommands, state) {
  const sessionFile = path.join(SESSION_DIR, `${userid}.json`);
  const history = getHistory();
  const existingIdx = history.findIndex(u => u.userid === userid);
  if (existingIdx !== -1) {
    history[existingIdx] = { ...history[existingIdx], prefix: prefix || '!', admin: admin || [], enableCommands };
  } else {
    history.push({ userid, prefix: prefix || '!', admin: admin || [], blacklist: [], enableCommands, time: 0 });
  }
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

// Check if a command is enabled - ALL enabled if list is empty/['*'] (default behavior)
function isCommandEnabled(enableCommands, cmdName) {
  const enabled = enableCommands?.[0]?.commands || [];
  // If empty array (default), ALL commands are enabled
  if (!enabled.length || enabled.includes('*')) return true;
  return enabled.includes(cmdName);
}

function isEventEnabled(enableCommands, evtName) {
  const enabled = enableCommands?.[1]?.handleEvent || [];
  if (!enabled.length || enabled.includes('*')) return true;
  return enabled.includes(evtName);
}

export async function loginAccount(state, prefix, admin, enableCommands) {
  ensureDirs();
  loadCommands();

  let login;
  try {
    let fca;
    try {
      fca = require('ws3-fca');
    } catch {
      // Try loading from workspace root node_modules
      const rootPath = path.join(WORKSPACE_ROOT, 'node_modules', 'ws3-fca');
      fca = require(rootPath);
    }
    login = typeof fca === 'function' ? fca : (fca.login || fca.default);
    if (typeof login !== 'function') throw new Error('Could not find login function in ws3-fca export');
  } catch (err) {
    throw new Error(`ws3-fca not available: ${err.message}. Run: pnpm add -w ws3-fca`);
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

      let name = `User_${userid}`;
      let profileUrl = null;
      let thumbSrc = null;
      try {
        const userInfo = await new Promise((res, rej) => {
          const result = api.getUserInfo(userid, (err, info) => {
            if (err) rej(err);
            else res(info);
          });
          if (result && typeof result.then === 'function') {
            result.then(res).catch(rej);
          }
        });
        const info = userInfo?.[userid] || userInfo?.[String(userid)] || userInfo;
        if (info?.name) {
          name = info.name;
          profileUrl = info.profileUrl || info.uri || null;
          thumbSrc = info.profilePicUrl || info.thumbSrc || info.thumbnail || null;
        }
      } catch {
        console.log(`[BotManager] Could not fetch profile for ${userid}, using fallback name.`);
      }

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

      const history = getHistory();
      const savedTime = (history.find(u => u.userid === userid) || {}).time || 0;
      Utils.account.set(userid, { name, profileUrl, thumbSrc, prefix, time: savedTime, online: true, enableCommands });

      const intervalId = setInterval(() => {
        const account = Utils.account.get(userid);
        if (!account) { clearInterval(intervalId); return; }
        Utils.account.set(userid, { ...account, time: account.time + 1 });
      }, 1000);

      addUserToHistory(userid, prefix, admin, enableCommands, state);

      api.listenMqtt(async (err, event) => {
        if (err) {
          if (err === 'Connection closed.' || err?.error === 'Connection closed.') {
            console.log(`[BotManager] Connection closed for ${userid}, session preserved.`);
          }
          return;
        }
        if (!event) return;

        const liveAccount = Utils.account.get(userid);
        const liveEnableCmds = liveAccount?.enableCommands || enableCommands;

        // Handle event listeners
        for (const { handleEvent, name: evtName } of Utils.handleEvent.values()) {
          if (handleEvent && evtName && isEventEnabled(liveEnableCmds, evtName)) {
            try { handleEvent({ api, event, prefix, admin }); } catch {}
          }
        }

        // Handle prefix commands
        if (event.body && event.body.startsWith(prefix || '!')) {
          const body = event.body.trim().slice((prefix || '!').length).trim();
          if (!body) return;
          const [rawCmd, ...args] = body.split(/\s+/);
          const cmd = findCommand(rawCmd);
          if (!cmd) return;

          const isAdmin = (admin || []).includes(event.senderID);
          if (Number(cmd.role) >= 1 && !isAdmin) {
            api.sendMessage("❌ You don't have permission to use this command.", event.threadID, event.messageID);
            return;
          }

          if (!isCommandEnabled(liveEnableCmds, cmd.name)) return;

          const now = Date.now();
          const cooldownKey = `${event.senderID}_${cmd.name}_${userid}`;
          const lastUse = Utils.cooldowns.get(cooldownKey);
          const delay = (cmd.cooldown || 5) * 1000;
          if (lastUse && (now - lastUse) < delay) {
            const remaining = Math.ceil((lastUse + delay - now) / 1000);
            api.sendMessage(`⏳ Please wait ${remaining}s before using "${cmd.name}" again.`, event.threadID, event.messageID);
            return;
          }
          Utils.cooldowns.set(cooldownKey, now);
          try {
            await cmd.run({ api, event, args, prefix, admin, Utils, DATA_DIR });
          } catch (runErr) {
            console.error(`[BotManager] Command "${cmd.name}" error:`, runErr?.message);
          }
        }
      });

      // Keep-alive: save uptime every 60s
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

      // Keep session alive every 5 min
      const keepAliveId = setInterval(async () => {
        const account = Utils.account.get(userid);
        if (!account) { clearInterval(keepAliveId); return; }
        try { await api.getUserInfo(userid).catch(() => {}); } catch {}
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

export function getAccountEnabledCommands(userid) {
  const account = Utils.account.get(userid);
  if (account?.enableCommands) {
    return {
      commands: account.enableCommands[0]?.commands || [],
      handleEvent: account.enableCommands[1]?.handleEvent || [],
    };
  }
  const history = getHistory();
  const user = history.find(u => u.userid === userid);
  if (!user) return { commands: [], handleEvent: [] };
  return {
    commands: user.enableCommands?.[0]?.commands || [],
    handleEvent: user.enableCommands?.[1]?.handleEvent || [],
  };
}

export function updateAccountCommands(userid, commands, handleEvent) {
  const account = Utils.account.get(userid);
  if (account) {
    Utils.account.set(userid, {
      ...account,
      enableCommands: [{ commands: commands || [] }, { handleEvent: handleEvent || [] }],
    });
  }
  const history = getHistory();
  const idx = history.findIndex(u => u.userid === userid);
  if (idx !== -1) {
    history[idx].enableCommands = [{ commands: commands || [] }, { handleEvent: handleEvent || [] }];
    saveHistory(history);
  }
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

// Add a custom command dynamically
export function addCustomCommand(name, code) {
  ensureDirs();
  // Validate code structure
  let mod;
  try {
    const tempFile = path.join(CUSTOM_COMMANDS_DIR, `__validate_${Date.now()}.js`);
    fs.writeFileSync(tempFile, code);
    try {
      delete require.cache[require.resolve(tempFile)];
      mod = require(tempFile);
    } finally {
      try { fs.unlinkSync(tempFile); } catch {}
      delete require.cache[require.resolve(tempFile)];
    }
  } catch (err) {
    throw new Error(`Invalid command code: ${err.message}`);
  }

  if (!mod.config) throw new Error('Command must export module.exports.config');
  if (!mod.run && !mod.handleEvent) throw new Error('Command must export module.exports.run or module.exports.handleEvent');
  if (!mod.config.name) throw new Error('Command config must have a name field');

  const cmdName = mod.config.name || name;
  const filePath = path.join(CUSTOM_COMMANDS_DIR, `${cmdName}.js`);
  fs.writeFileSync(filePath, code);

  // Hot reload
  loadSingleCommand(filePath);
  return cmdName;
}

// Remove a custom command dynamically
export function removeCustomCommand(name) {
  ensureDirs();
  const filePath = path.join(CUSTOM_COMMANDS_DIR, `${name}.js`);
  if (!fs.existsSync(filePath)) throw new Error(`Custom command "${name}" not found`);
  try { delete require.cache[require.resolve(filePath)]; } catch {}
  fs.unlinkSync(filePath);
  // Remove from maps
  for (const [aliases] of Utils.commands.entries()) {
    if (aliases.includes(name)) { Utils.commands.delete(aliases); break; }
  }
  for (const [aliases] of Utils.handleEvent.entries()) {
    if (aliases.includes(name)) { Utils.handleEvent.delete(aliases); break; }
  }
  return true;
}

export function getCustomCommands() {
  ensureDirs();
  const files = fs.existsSync(CUSTOM_COMMANDS_DIR)
    ? fs.readdirSync(CUSTOM_COMMANDS_DIR).filter(f => f.endsWith('.js'))
    : [];
  return files.map(f => f.replace('.js', ''));
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
      console.log(`[BotManager] Restored session for ${userid}`);
    } catch (err) {
      console.error(`[BotManager] Failed to restore session for ${userid}:`, err.message);
      removeUserFromHistory(userid);
    }
  }
}
