// Bot Manager - Pure JavaScript ES Module (ws3-fca integration)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(WORKSPACE_ROOT, 'bot-data');
const SESSION_DIR = path.join(DATA_DIR, 'session');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const COMMANDS_DIR = path.join(WORKSPACE_ROOT, 'bot-commands');
const CUSTOM_COMMANDS_DIR = path.join(DATA_DIR, 'commands');

// Developer info (links shown in dashboard/commands)
export const DEVELOPER = {
  uid: '61576783743431',
  fb: 'https://www.facebook.com/notfound500',
  tg: 'https://t.me/trciks',
};

const Utils = {
  commands: new Map(),
  handleEvent: new Map(),
  account: new Map(),   // userid -> { name, prefix, time, online, enableCommands, api, accessKey, threadSet }
  cooldowns: new Map(),
};

// ──────────────────────────────────────────────────────────────
// Command loading
// ──────────────────────────────────────────────────────────────
function loadSingleCommand(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    const mod = require(filePath);
    if (!mod.config) return null;
    const cfg = mod.config;
    const name = cfg.name || path.basename(filePath, '.js');
    const aliases = Array.isArray(cfg.aliases) ? [...new Set([...cfg.aliases, name])] : [name];
    const base = {
      name, aliases,
      description: cfg.description || '', usage: cfg.usage || cfg.usages || '',
      version: cfg.version || '1.0.0', hasPrefix: cfg.hasPrefix !== false && cfg.prefix !== false,
      credits: cfg.credits || '', cooldown: cfg.cooldown || cfg.cooldowns || 5,
      dev: cfg.dev || false, category: cfg.category || 'general',
      role: cfg.role || cfg.permission || 0,
    };
    if (mod.run) Utils.commands.set(aliases, { ...base, run: mod.run });
    if (mod.handleEvent) Utils.handleEvent.set(aliases, { ...base, handleEvent: mod.handleEvent });
    return name;
  } catch (err) {
    console.error(`[BotManager] Failed to load ${filePath}:`, err.message);
    return null;
  }
}

function loadCommandsFromDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => loadSingleCommand(path.join(dir, f)));
}

export function loadCommands() {
  Utils.commands.clear();
  Utils.handleEvent.clear();
  [COMMANDS_DIR, CUSTOM_COMMANDS_DIR].forEach(dir => { if (fs.existsSync(dir)) loadCommandsFromDir(dir); });
  console.log(`[BotManager] Loaded ${Utils.commands.size} commands, ${Utils.handleEvent.size} event handlers`);
}

(function initCommands() {
  try {
    [COMMANDS_DIR, CUSTOM_COMMANDS_DIR].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });
    loadCommandsFromDir(COMMANDS_DIR);
    loadCommandsFromDir(CUSTOM_COMMANDS_DIR);
    console.log(`[BotManager] Loaded ${Utils.commands.size} cmds, ${Utils.handleEvent.size} events on startup`);
  } catch (err) { console.error('[BotManager] Init error:', err.message); }
}());

// ──────────────────────────────────────────────────────────────
// Persistence helpers
// ──────────────────────────────────────────────────────────────
function ensureDirs() {
  [DATA_DIR, SESSION_DIR, CUSTOM_COMMANDS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
}

function getHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); } catch { return []; }
}

function saveHistory(h) {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); } catch (e) { console.error('[BotManager] Save history failed:', e.message); }
}

function addUserToHistory(userid, prefix, admin, enableCommands, state, accessKey) {
  const history = getHistory();
  const idx = history.findIndex(u => u.userid === userid);
  const entry = { userid, prefix: prefix || '!', admin: admin || [], blacklist: [], enableCommands, time: 0, ...(accessKey ? { accessKey } : {}) };
  if (idx !== -1) history[idx] = { ...history[idx], ...entry };
  else history.push(entry);
  saveHistory(history);
  fs.writeFileSync(path.join(SESSION_DIR, `${userid}.json`), JSON.stringify(state));
}

function removeUserFromHistory(userid) {
  const h = getHistory();
  const idx = h.findIndex(u => u.userid === userid);
  if (idx !== -1) h.splice(idx, 1);
  saveHistory(h);
  try { const f = path.join(SESSION_DIR, `${userid}.json`); if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
}

// ──────────────────────────────────────────────────────────────
// Command dispatch helpers
// ──────────────────────────────────────────────────────────────
function findCommand(command) {
  if (!command) return null;
  const lc = command.toLowerCase();
  const found = Array.from(Utils.commands.entries()).find(([cmds]) => cmds.some(c => c.toLowerCase() === lc));
  return found ? found[1] : null;
}

function isCommandEnabled(enableCommands, name) {
  const enabled = enableCommands?.[0]?.commands || [];
  return !enabled.length || enabled.includes('*') || enabled.includes(name);
}

function isEventEnabled(enableCommands, name) {
  const enabled = enableCommands?.[1]?.handleEvent || [];
  return !enabled.length || enabled.includes('*') || enabled.includes(name);
}

// ──────────────────────────────────────────────────────────────
// Auto-greeting scheduler (PHT = UTC+8)
// ──────────────────────────────────────────────────────────────
const greetedLog = new Map(); // userid -> { morningDate, nightDate }
const GREET_FILE = () => path.join(DATA_DIR, 'greet.json');

function getGreetData() {
  try { return JSON.parse(fs.readFileSync(GREET_FILE(), 'utf-8')); } catch { return { threads: [] }; }
}

function getPHTHour() {
  const d = new Date();
  return new Date(d.getTime() + 8 * 3600 * 1000).getUTCHours();
}

function getPHTDateStr() {
  const d = new Date();
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function startGreetScheduler(userid) {
  setInterval(() => {
    const account = Utils.account.get(userid);
    if (!account?.api) return;

    const hour = getPHTHour();
    const today = getPHTDateStr();
    const log = greetedLog.get(userid) || {};

    if (hour === 6 && log.morningDate !== today) {
      greetedLog.set(userid, { ...log, morningDate: today });
      const greetData = getGreetData();
      const threads = greetData.threads || [];
      const msgs = [
        '☀️ Good morning everyone! Wishing you all a productive and amazing day ahead! 🌅',
        '🌞 Rise and shine! Good morning, fam! Let\'s make today count! ✨',
        '☀️ Good morning! Hope you all slept well. Have a blessed day! 🙏',
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      threads.forEach(tid => { try { account.api.sendMessage(msg, tid); } catch {} });
    }

    if (hour === 21 && log.nightDate !== today) {
      greetedLog.set(userid, { ...log, nightDate: today });
      const greetData = getGreetData();
      const threads = greetData.threads || [];
      const msgs = [
        '🌙 Good night everyone! Rest well and dream big! ⭐',
        '😴 Good night, fam! Time to recharge for another great day! 🌙✨',
        '🌙 Wishing everyone a peaceful night! See you tomorrow! 💤',
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      threads.forEach(tid => { try { account.api.sendMessage(msg, tid); } catch {} });
    }
  }, 60 * 1000); // check every minute
}

// ──────────────────────────────────────────────────────────────
// Thread tracking (persist all seen GC threads)
// ──────────────────────────────────────────────────────────────
const THREADS_FILE = () => path.join(DATA_DIR, 'threads.json');

function getTrackedThreads() {
  try { return JSON.parse(fs.readFileSync(THREADS_FILE(), 'utf-8')); } catch { return []; }
}

function saveThread(threadID) {
  if (!threadID) return;
  const threads = getTrackedThreads();
  if (!threads.includes(threadID)) {
    threads.push(threadID);
    try { fs.writeFileSync(THREADS_FILE(), JSON.stringify(threads)); } catch {}
  }
}

// ──────────────────────────────────────────────────────────────
// Lottery helpers
// ──────────────────────────────────────────────────────────────
function getLottery() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lottery.json'), 'utf-8')); }
  catch { return { pot: 0, jackpot: 0, tickets: {}, lastDraw: null }; }
}
function saveLottery(data) {
  try { fs.writeFileSync(path.join(DATA_DIR, 'lottery.json'), JSON.stringify(data, null, 2)); } catch {}
}
function getEconomyBM() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'economy.json'), 'utf-8')); }
  catch { return { users: {} }; }
}
function saveEconomyBM(data) {
  try { fs.writeFileSync(path.join(DATA_DIR, 'economy.json'), JSON.stringify(data, null, 2)); } catch {}
}

// ──────────────────────────────────────────────────────────────
// Hourly broadcast + lottery draw
// ──────────────────────────────────────────────────────────────
function drawLottery(api, threads) {
  const lotto = getLottery();
  const entries = Object.entries(lotto.tickets || {});
  if (entries.length === 0 || lotto.pot === 0) return null;

  // Build weighted pool
  const pool = [];
  for (const [uid, data] of entries) {
    for (let i = 0; i < data.count; i++) pool.push(uid);
  }
  const winnerUID = pool[Math.floor(Math.random() * pool.length)];
  const winner = lotto.tickets[winnerUID];
  const prize = Math.floor(lotto.pot * 0.70);
  const jackpotAdd = lotto.pot - prize;

  // Pay winner
  const eco = getEconomyBM();
  if (eco.users[winnerUID]) {
    eco.users[winnerUID].balance += prize;
    saveEconomyBM(eco);
  }

  const prevPot = lotto.pot;
  lotto.jackpot = (lotto.jackpot || 0) + jackpotAdd;
  lotto.pot = 0;
  lotto.tickets = {};
  lotto.lastDraw = new Date().toISOString();
  saveLottery(lotto);

  const winnerName = winner.name || `User_${winnerUID}`;
  const msg = [
    '🎰 ╔══ LOTTERY DRAW ══╗',
    `🎫 Pot: ${prevPot.toLocaleString()} coins`,
    '',
    `🏆 Winner: ${winnerName}`,
    `💰 Prize: ${prize.toLocaleString()} coins (70%)`,
    `🎁 Jackpot grew by: ${jackpotAdd.toLocaleString()} coins`,
    `💎 Total Jackpot: ${lotto.jackpot.toLocaleString()} coins`,
    '',
    '⏰ Next round starts now!',
    '🎟 Buy tickets: !lottery <count>',
  ].join('\n');

  threads.forEach(tid => { try { api.sendMessage(msg, tid); } catch {} });
  return { winnerName, prize };
}

function buildBroadcastMsg(prefix) {
  const eco = getEconomyBM();
  const lotto = getLottery();
  const users = Object.values(eco.users || {})
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3);

  const medals = ['🥇', '🥈', '🥉'];
  const top3 = users.length
    ? users.map((u, i) => `${medals[i]} ${u.name} — ${u.balance.toLocaleString()} coins`).join('\n')
    : 'No players yet';

  const lines = [
    '🎮 ╔══ HOURLY UPDATE ══╗',
    '',
    '🏆 Top 3 Leaderboard:',
    top3,
    '',
    `🎫 Lottery Pot: ${lotto.pot.toLocaleString()} coins`,
    `💎 Jackpot: ${lotto.jackpot.toLocaleString()} coins`,
    '',
    '🎲 Play now & win big!',
    `${prefix}slots  ${prefix}flip  ${prefix}dice  ${prefix}rps`,
    `${prefix}wheel  ${prefix}blackjack  ${prefix}steal  ${prefix}lottery`,
    '',
    `📋 ${prefix}help for all commands`,
  ];
  return lines.join('\n');
}

function startHourlyBroadcast(userid) {
  // Stagger first broadcast so multiple bots don't all fire at once
  const INTERVAL = 60 * 60 * 1000; // 1 hour
  const stagger = Math.random() * 30000; // 0-30s stagger

  setTimeout(() => {
    const run = () => {
      const account = Utils.account.get(userid);
      if (!account?.api) return;

      const threads = getTrackedThreads();
      if (threads.length === 0) return;

      // Draw lottery if there's a pot
      const lotto = getLottery();
      const hasTickets = Object.keys(lotto.tickets || {}).length > 0;
      if (hasTickets && lotto.pot > 0) {
        drawLottery(account.api, threads);
        // Small delay before broadcasting so lottery message lands first
        setTimeout(() => {
          const msg = buildBroadcastMsg(account.prefix || '!');
          threads.forEach(tid => { try { account.api.sendMessage(msg, tid); } catch {} });
        }, 3000);
      } else {
        const msg = buildBroadcastMsg(account.prefix || '!');
        threads.forEach(tid => { try { account.api.sendMessage(msg, tid); } catch {} });
      }
    };

    run();
    setInterval(run, INTERVAL);
  }, stagger);
}

// ──────────────────────────────────────────────────────────────
// Auto-post scheduler (every 2 hours to opted-in threads)
// ──────────────────────────────────────────────────────────────
const AUTOPOST_INTERVAL = 2 * 60 * 60 * 1000;
const AUTO_POSTS = [
  '🎮 Game time! Who wants to play? Drop a 🙋 if you\'re in!',
  '🌟 Fact: The average person laughs 15 times a day. Let\'s make it 16! 😂',
  '☕ Good vibes only in this group! How\'s everyone doing today? 😊',
  '🎵 Music mood: What song is stuck in your head right now? Drop it! 🎶',
  '🤔 Question: If you could travel anywhere right now, where would you go?',
  '💡 Life tip: Drink more water, sleep enough, and never stop learning! 📚',
  '🎲 Fun fact: Honey never expires. They found 3000-year-old honey in Egyptian tombs still edible! 🍯',
  '🌈 Reminder: You are doing better than you think you are! Keep going! 💪',
  '🎯 Challenge: Send one kind message to someone today. Spread positivity! 💖',
  '🍕 Important question: Pineapple on pizza — yes or no? Vote now! 🗳️',
  '🤣 Joke time: Why don\'t scientists trust atoms? Because they make up everything! 😆',
  '🌺 Appreciation post: Drop a ❤️ if this group chat brings you joy!',
  '💪 Motivation: "The best time to plant a tree was 20 years ago. The second best time is now." 🌳',
  '🎊 Weekend vibes incoming! What are your plans? 🗓️',
  '🍜 Foodie question: What\'s your favorite comfort food? 🍽️',
];

function getAutopostData() {
  const f = path.join(DATA_DIR, 'autopost.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return { threads: [] }; }
}

function startAutopostScheduler(userid) {
  const stagger = Math.random() * 60000;
  setTimeout(() => {
    const run = () => {
      const account = Utils.account.get(userid);
      if (!account?.api) return;
      const data = getAutopostData();
      const threads = data.threads || [];
      if (threads.length === 0) return;
      const post = AUTO_POSTS[Math.floor(Math.random() * AUTO_POSTS.length)];
      threads.forEach(tid => { try { account.api.sendMessage(post, tid); } catch {} });
    };
    run();
    setInterval(run, AUTOPOST_INTERVAL);
  }, stagger);
}

// ──────────────────────────────────────────────────────────────
// Main login function
// ──────────────────────────────────────────────────────────────
export async function loginAccount(state, prefix, admin, enableCommands, accessKey) {
  ensureDirs();
  loadCommands();

  let login;
  try {
    let fca;
    try { fca = require('ws3-fca'); } catch {
      fca = require(path.join(WORKSPACE_ROOT, 'node_modules', 'ws3-fca'));
    }
    login = typeof fca === 'function' ? fca : (fca.login || fca.default);
    if (typeof login !== 'function') throw new Error('Could not find login function in ws3-fca');
  } catch (err) { throw new Error(`ws3-fca not available: ${err.message}`); }

  return new Promise((resolve, reject) => {
    login({ appState: state }, async (error, api) => {
      if (error) { reject(new Error(typeof error === 'string' ? error : error.message || JSON.stringify(error))); return; }

      const userid = api.getCurrentUserID();
      if (Utils.account.get(userid)) { reject(new Error('Account already logged in')); return; }

      // Fetch user info
      let name = `User_${userid}`, profileUrl = null, thumbSrc = null;
      try {
        const info = await new Promise((res, rej) => {
          const r = api.getUserInfo(userid, (e, d) => e ? rej(e) : res(d));
          if (r && typeof r.then === 'function') r.then(res).catch(rej);
        });
        const u = info?.[userid] || info?.[String(userid)] || info;
        if (u?.name) { name = u.name; profileUrl = u.profileUrl || u.uri || null; thumbSrc = u.profilePicUrl || u.thumbSrc || null; }
      } catch { console.log(`[BotManager] Profile fetch failed for ${userid}`); }

      api.setOptions({ listenEvents: true, logLevel: 'silent', updatePresence: false, selfListen: false, forceLogin: true, online: true, autoMarkDelivery: false, autoMarkRead: false });

      const history = getHistory();
      const savedTime = (history.find(u => u.userid === userid) || {}).time || 0;

      // Thread set for auto-greetings
      const threadSet = new Set();

      Utils.account.set(userid, { name, profileUrl, thumbSrc, prefix, time: savedTime, online: true, enableCommands, api, accessKey: accessKey || null, threadSet });

      // Uptime ticker
      const uptimeTick = setInterval(() => {
        const acc = Utils.account.get(userid);
        if (!acc) { clearInterval(uptimeTick); return; }
        Utils.account.set(userid, { ...acc, time: acc.time + 1 });
      }, 1000);

      addUserToHistory(userid, prefix, admin, enableCommands, state, accessKey);

      // Start greeting scheduler + hourly broadcast + autopost
      startGreetScheduler(userid);
      startHourlyBroadcast(userid);
      startAutopostScheduler(userid);

      // Start listener
      api.listenMqtt(async (err, event) => {
        if (err) {
          if (err === 'Connection closed.' || err?.error === 'Connection closed.') {
            console.log(`[BotManager] MQTT closed for ${userid}, session preserved.`);
          }
          return;
        }
        if (!event) return;

        const liveAccount = Utils.account.get(userid);
        const liveEnableCmds = liveAccount?.enableCommands || enableCommands;

        // Track group thread IDs for auto-greetings + hourly broadcast
        if (event.threadID && event.senderID !== event.threadID) {
          liveAccount?.threadSet?.add(event.threadID);
          saveThread(event.threadID);
        }

        // Run all event handlers
        for (const { handleEvent, name: evtName } of Utils.handleEvent.values()) {
          if (handleEvent && evtName && isEventEnabled(liveEnableCmds, evtName)) {
            try { handleEvent({ api, event, prefix, admin, DATA_DIR }); } catch {}
          }
        }

        // Prefix commands
        if (event.body && event.body.startsWith(prefix || '!')) {
          const body = event.body.trim().slice((prefix || '!').length).trim();
          if (!body) return;
          const [rawCmd, ...args] = body.split(/\s+/);
          const cmd = findCommand(rawCmd);
          if (!cmd) return;

          const isAdmin = (admin || []).includes(event.senderID);
          if (Number(cmd.role) >= 1 && !isAdmin) {
            api.sendMessage('❌ You do not have permission to use this command.', event.threadID, event.messageID);
            return;
          }
          if (!isCommandEnabled(liveEnableCmds, cmd.name)) return;

          const now = Date.now();
          const ck = `${event.senderID}_${cmd.name}_${userid}`;
          const last = Utils.cooldowns.get(ck);
          const delay = (cmd.cooldown || 5) * 1000;
          if (last && (now - last) < delay) {
            const rem = Math.ceil((last + delay - now) / 1000);
            api.sendMessage(`⏳ Wait ${rem}s before using "${cmd.name}" again.`, event.threadID, event.messageID);
            return;
          }
          Utils.cooldowns.set(ck, now);
          try { await cmd.run({ api, event, args, prefix, admin, Utils, DATA_DIR }); }
          catch (e) { console.error(`[BotManager] "${cmd.name}" error:`, e?.message); }
        }
      });

      // Save uptime every 60s
      const saveTick = setInterval(() => {
        const acc = Utils.account.get(userid);
        if (!acc) { clearInterval(saveTick); return; }
        const h = getHistory(); const idx = h.findIndex(u => u.userid === userid);
        if (idx !== -1) { h[idx].time = acc.time; saveHistory(h); }
      }, 60 * 1000);

      // Keep-alive ping every 5 min
      const pingTick = setInterval(async () => {
        const acc = Utils.account.get(userid);
        if (!acc) { clearInterval(pingTick); return; }
        try { await api.getUserInfo(userid).catch(() => {}); } catch {}
      }, 5 * 60 * 1000);

      resolve({ userid, name, profileUrl, thumbSrc });
    });
  });
}

// ──────────────────────────────────────────────────────────────
// Logout (with optional access key check)
// ──────────────────────────────────────────────────────────────
export async function logoutAccount(userid, accessKey) {
  const account = Utils.account.get(userid);
  if (!account) throw new Error('Account not found');

  // Check access key
  if (account.accessKey) {
    if (!accessKey) throw new Error('ACCESS_KEY_REQUIRED');
    if (accessKey !== account.accessKey) throw new Error('INVALID_ACCESS_KEY');
  }

  Utils.account.delete(userid);
  removeUserFromHistory(userid);
}

// ──────────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────────
export function getAccounts() {
  return Array.from(Utils.account.entries()).map(([userid, d]) => ({
    userid, name: d.name, profileUrl: d.profileUrl || null, thumbSrc: d.thumbSrc || null,
    time: d.time, prefix: d.prefix || '!', online: d.online !== false,
    hasKey: !!d.accessKey,
  }));
}

export function getAccount(userid) { return Utils.account.get(userid) || null; }

export function getAccountEnabledCommands(userid) {
  const account = Utils.account.get(userid);
  if (account?.enableCommands) return { commands: account.enableCommands[0]?.commands || [], handleEvent: account.enableCommands[1]?.handleEvent || [] };
  const h = getHistory(); const user = h.find(u => u.userid === userid);
  if (!user) return { commands: [], handleEvent: [] };
  return { commands: user.enableCommands?.[0]?.commands || [], handleEvent: user.enableCommands?.[1]?.handleEvent || [] };
}

export function updateAccountCommands(userid, commands, handleEvent) {
  const account = Utils.account.get(userid);
  if (account) Utils.account.set(userid, { ...account, enableCommands: [{ commands: commands || [] }, { handleEvent: handleEvent || [] }] });
  const h = getHistory(); const idx = h.findIndex(u => u.userid === userid);
  if (idx !== -1) { h[idx].enableCommands = [{ commands: commands || [] }, { handleEvent: handleEvent || [] }]; saveHistory(h); }
}

export function getCommands() {
  const seen = new Set(), commands = [], handleEvent = [], commandDetails = [], handleEventDetails = [];
  for (const cmd of Utils.commands.values()) {
    if (!seen.has(cmd.name)) {
      seen.add(cmd.name); commands.push(cmd.name);
      commandDetails.push({ name: cmd.name, description: cmd.description || '', usage: cmd.usage || '', credits: cmd.credits || '', role: cmd.role || 0, cooldown: cmd.cooldown || 5, aliases: (cmd.aliases || []).filter(a => a !== cmd.name), hasPrefix: cmd.hasPrefix !== false, version: cmd.version || '1.0.0', category: cmd.category || 'general', dev: cmd.dev || false });
    }
  }
  for (const evt of Utils.handleEvent.values()) {
    if (!seen.has(evt.name)) {
      seen.add(evt.name); handleEvent.push(evt.name);
      handleEventDetails.push({ name: evt.name, description: evt.description || '', usage: evt.usage || '', credits: evt.credits || '', role: evt.role || 0, cooldown: evt.cooldown || 5, hasPrefix: evt.hasPrefix !== false, version: evt.version || '1.0.0', category: evt.category || 'general' });
    }
  }
  return { commands, handleEvent, commandDetails, handleEventDetails };
}

export function addCustomCommand(name, code) {
  ensureDirs();
  let mod, cmdName;
  try {
    const tmp = path.join(CUSTOM_COMMANDS_DIR, `__validate_${Date.now()}.js`);
    fs.writeFileSync(tmp, code);
    try { delete require.cache[require.resolve(tmp)]; mod = require(tmp); } finally { try { fs.unlinkSync(tmp); delete require.cache[require.resolve(tmp)]; } catch {} }
  } catch (err) { throw new Error(`Invalid code: ${err.message}`); }
  if (!mod.config) throw new Error('Missing module.exports.config');
  if (!mod.run && !mod.handleEvent) throw new Error('Missing module.exports.run or handleEvent');
  if (!mod.config.name) throw new Error('config.name is required');
  cmdName = mod.config.name;
  const fp = path.join(CUSTOM_COMMANDS_DIR, `${cmdName}.js`);
  fs.writeFileSync(fp, code);
  loadSingleCommand(fp);
  return cmdName;
}

export function removeCustomCommand(name) {
  ensureDirs();
  const fp = path.join(CUSTOM_COMMANDS_DIR, `${name}.js`);
  if (!fs.existsSync(fp)) throw new Error(`Custom command "${name}" not found`);
  try { delete require.cache[require.resolve(fp)]; } catch {}
  fs.unlinkSync(fp);
  for (const [aliases] of Utils.commands.entries()) { if (aliases.includes(name)) { Utils.commands.delete(aliases); break; } }
  for (const [aliases] of Utils.handleEvent.entries()) { if (aliases.includes(name)) { Utils.handleEvent.delete(aliases); break; } }
  return true;
}

export function getCustomCommands() {
  ensureDirs();
  return fs.existsSync(CUSTOM_COMMANDS_DIR) ? fs.readdirSync(CUSTOM_COMMANDS_DIR).filter(f => f.endsWith('.js')).map(f => f.replace('.js', '')) : [];
}

export async function restoreSessionsOnStartup() {
  ensureDirs();
  loadCommands();
  if (!fs.existsSync(SESSION_DIR)) return;
  const history = getHistory();
  for (const file of fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'))) {
    const userid = path.parse(file).name;
    const userHistory = history.find(u => u.userid === userid);
    if (!userHistory) continue;
    try {
      const state = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8'));
      await loginAccount(state, userHistory.prefix, userHistory.admin, userHistory.enableCommands, userHistory.accessKey);
      console.log(`[BotManager] Restored session for ${userid}`);
    } catch (err) { console.error(`[BotManager] Restore failed for ${userid}:`, err.message); removeUserFromHistory(userid); }
  }
}
