import { Router, type IRouter } from "express";
import { db, DB_AVAILABLE, gamesTable, gamePlayersTable, activityLogTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import path from "path";
import fs from "fs";

const router: IRouter = Router();
const startedAt = new Date().toISOString();

const WORKSPACE_ROOT = path.resolve(process.cwd());
const BOT_DATA_DIR = process.env.BOT_DATA_DIR || path.join(WORKSPACE_ROOT, "bot-data");

function getEconomy() {
  const file = path.join(BOT_DATA_DIR, "economy.json");
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return { users: {} }; }
}

// ── File-based activity log fallback (used when DB is absent) ──────────────
const ACTIVITY_FILE = path.join(BOT_DATA_DIR, "activity.json");

function readActivityLog(): Array<{ id: number; type: string; message: string; userid: string | null; timestamp: string }> {
  try { return JSON.parse(fs.readFileSync(ACTIVITY_FILE, "utf-8")); } catch { return []; }
}

function writeActivityLog(entries: ReturnType<typeof readActivityLog>) {
  try {
    fs.mkdirSync(BOT_DATA_DIR, { recursive: true });
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(entries.slice(-500), null, 2));
  } catch {}
}

function logActivity(type: string, message: string, userid?: string) {
  if (DB_AVAILABLE) {
    db.insert(activityLogTable)
      .values({ type, message, userid: userid ?? null })
      .catch((err: Error) => logger.error({ err }, "Failed to log activity"));
    return;
  }
  // File-based fallback
  const log = readActivityLog();
  log.push({ id: Date.now(), type, message, userid: userid ?? null, timestamp: new Date().toISOString() });
  writeActivityLog(log);
}

// ── Safe DB query wrapper ──────────────────────────────────────────────────
async function safeSelect<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!DB_AVAILABLE) return fallback;
  try { return await fn(); } catch { return fallback; }
}

// ── File-based games store (used when DB is absent) ───────────────────────
const GAMES_FILE = path.join(BOT_DATA_DIR, "games.json");

type FileGame = {
  id: number; name: string; description: string; reward: string;
  status: string; maxPlayers: number | null; createdAt: string; updatedAt: string;
  players: Array<{ id: number; playerId: string; playerName: string; claimed: boolean; claimedAt: string | null; registeredAt: string }>;
};

function readGames(): FileGame[] {
  try { return JSON.parse(fs.readFileSync(GAMES_FILE, "utf-8")); } catch { return []; }
}
function writeGames(games: FileGame[]) {
  try { fs.mkdirSync(BOT_DATA_DIR, { recursive: true }); fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2)); } catch {}
}
function nextId(arr: { id: number }[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map((x) => x.id)) + 1;
}

// ════════════════════════════════════════════════════════════════════════════
// Bot account routes
// ════════════════════════════════════════════════════════════════════════════

router.get("/bot/accounts", async (_req, res): Promise<void> => {
  try {
    const bm = await import("../lib/botManager.js");
    res.json(bm.getAccounts());
  } catch { res.json([]); }
});

router.post("/bot/login", async (req, res): Promise<void> => {
  const { state, prefix, admin, commands } = req.body;
  if (!state || !Array.isArray(state)) {
    res.status(400).json({ error: "Invalid appstate", success: false, message: "Missing or invalid appstate data" });
    return;
  }
  const cUser = (state as Array<{ key: string; value: string }>).find((i) => i.key === "c_user");
  if (!cUser) {
    res.status(400).json({ error: "No c_user in appstate", success: false, message: "Invalid appstate: missing c_user cookie" });
    return;
  }
  try {
    const bm = await import("../lib/botManager.js");
    if (bm.getAccount(cUser.value)) {
      res.status(400).json({ success: false, message: "Account already logged in", error: false });
      return;
    }
    const accessKey = typeof req.body.accessKey === "string" && req.body.accessKey.trim() ? req.body.accessKey.trim() : undefined;
    await bm.loginAccount(state, prefix || "!", admin ? [admin] : [], commands || [{ commands: [] }, { handleEvent: [] }], accessKey);
    logActivity("login", `Bot account ${cUser.value} logged in`, cUser.value);
    res.json({ success: true, message: "Login successful", error: false });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Bot login failed");
    res.status(400).json({ success: false, message: errMsg, error: true });
  }
});

router.get("/bot/accounts/:userid/commands", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  try {
    const bm = await import("../lib/botManager.js");
    res.json(bm.getAccountEnabledCommands(userid));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.put("/bot/accounts/:userid/commands", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  const { commands, handleEvent } = req.body as { commands: string[]; handleEvent: string[] };
  try {
    const bm = await import("../lib/botManager.js");
    bm.updateAccountCommands(userid, commands || [], handleEvent || []);
    logActivity("config", `Commands updated for account ${userid}`, userid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.delete("/bot/accounts/:userid", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  const accessKey = typeof req.body?.accessKey === "string" ? req.body.accessKey.trim() : undefined;
  try {
    const bm = await import("../lib/botManager.js");
    if (!bm.getAccount(userid)) { res.status(404).json({ error: "Account not found" }); return; }
    await bm.logoutAccount(userid, accessKey);
    logActivity("logout", `Bot account ${userid} logged out`, userid);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === "ACCESS_KEY_REQUIRED") { res.status(403).json({ error: "Access key required", code: "ACCESS_KEY_REQUIRED" }); return; }
    if (errMsg === "INVALID_ACCESS_KEY") { res.status(403).json({ error: "Invalid access key", code: "INVALID_ACCESS_KEY" }); return; }
    res.status(500).json({ error: errMsg });
  }
});

router.get("/bot/commands", async (_req, res): Promise<void> => {
  try {
    const bm = await import("../lib/botManager.js");
    const { commands, handleEvent, commandDetails, handleEventDetails } = bm.getCommands();
    res.json({ commands, handleEvent, commandDetails: commandDetails ?? [], handleEventDetails: handleEventDetails ?? [], total: commands.length + handleEvent.length });
  } catch { res.json({ commands: [], handleEvent: [], commandDetails: [], handleEventDetails: [], total: 0 }); }
});

router.post("/bot/commands/reload", async (_req, res): Promise<void> => {
  try {
    const bm = await import("../lib/botManager.js");
    bm.loadCommands();
    res.json({ success: true, message: "Commands reloaded" });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post("/bot/commands/custom", async (req, res): Promise<void> => {
  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "code is required" }); return; }
  try {
    const bm = await import("../lib/botManager.js");
    const name = bm.addCustomCommand("", code);
    logActivity("cmd_add", `Custom command "${name}" added`);
    res.json({ success: true, name });
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

router.delete("/bot/commands/custom/:name", async (req, res): Promise<void> => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  try {
    const bm = await import("../lib/botManager.js");
    bm.removeCustomCommand(name);
    logActivity("cmd_remove", `Custom command "${name}" removed`);
    res.json({ success: true });
  } catch (err) { res.status(404).json({ error: String(err) }); }
});

router.get("/bot/commands/custom", async (_req, res): Promise<void> => {
  try {
    const bm = await import("../lib/botManager.js");
    res.json(bm.getCustomCommands());
  } catch { res.json([]); }
});

router.get("/bot/stats", async (_req, res): Promise<void> => {
  const uptime = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  try {
    const bm = await import("../lib/botManager.js");
    const accounts = bm.getAccounts();
    const { commands, handleEvent } = bm.getCommands();
    const totalGames = DB_AVAILABLE
      ? Number((await safeSelect(() => db.select({ count: count() }).from(gamesTable), [{ count: 0 }]))[0]?.count ?? 0)
      : readGames().length;
    const eco = getEconomy();
    res.json({
      uptime, accountsOnline: accounts.length,
      totalCommands: commands.length + handleEvent.length,
      totalGames, totalUsers: Object.keys(eco.users || {}).length, startedAt,
    });
  } catch {
    res.json({ uptime, accountsOnline: 0, totalCommands: 0, totalGames: 0, totalUsers: 0, startedAt });
  }
});

router.get("/bot/activity", async (_req, res): Promise<void> => {
  if (!DB_AVAILABLE) {
    res.json(readActivityLog().reverse().slice(0, 50));
    return;
  }
  try {
    const rows = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.timestamp)).limit(50);
    res.json(rows.map((r) => ({ ...r, timestamp: r.timestamp.toISOString() })));
  } catch { res.json(readActivityLog().reverse().slice(0, 50)); }
});

// ════════════════════════════════════════════════════════════════════════════
// Economy routes (always file-based)
// ════════════════════════════════════════════════════════════════════════════

router.get("/economy/users", async (_req, res): Promise<void> => {
  const eco = getEconomy();
  const users = Object.entries(eco.users || {})
    .map(([id, u]: [string, any]) => ({ userid: id, name: u.name, balance: u.balance, lastClaim: u.lastClaim, registeredAt: u.registeredAt }))
    .sort((a, b) => b.balance - a.balance);
  res.json(users);
});

router.get("/economy/users/:userid", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  const eco = getEconomy();
  const user = eco.users?.[userid];
  if (!user) { res.status(404).json({ error: "User not registered" }); return; }
  res.json({ userid, ...user });
});

// ════════════════════════════════════════════════════════════════════════════
// Games routes — DB when available, JSON file fallback otherwise
// ════════════════════════════════════════════════════════════════════════════

router.get("/games", async (_req, res): Promise<void> => {
  if (!DB_AVAILABLE) {
    const games = readGames();
    res.json(games.map((g) => ({ ...g, registeredCount: g.players.length, claimedCount: g.players.filter((p) => p.claimed).length, players: undefined })));
    return;
  }
  try {
    const games = await db.select().from(gamesTable).orderBy(desc(gamesTable.createdAt));
    const result = await Promise.all(games.map(async (game) => {
      const [reg] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, game.id));
      const [cl] = await db.select({ count: count() }).from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, game.id), eq(gamePlayersTable.claimed, true)));
      return { ...game, createdAt: game.createdAt.toISOString(), registeredCount: Number(reg?.count ?? 0), claimedCount: Number(cl?.count ?? 0) };
    }));
    res.json(result);
  } catch { res.json([]); }
});

router.post("/games", async (req, res): Promise<void> => {
  const { name, description, reward, maxPlayers, status } = req.body as { name: string; description: string; reward: string; maxPlayers?: number; status?: string };
  if (!name || !description || !reward) { res.status(400).json({ error: "name, description, and reward are required" }); return; }
  if (!DB_AVAILABLE) {
    const games = readGames();
    const game: FileGame = { id: nextId(games), name, description, reward, status: status || "active", maxPlayers: maxPlayers ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), players: [] };
    games.push(game);
    writeGames(games);
    logActivity("game_created", `Game "${name}" created`);
    res.status(201).json({ ...game, players: undefined, registeredCount: 0, claimedCount: 0 });
    return;
  }
  try {
    const [game] = await db.insert(gamesTable).values({ name, description, reward, maxPlayers: maxPlayers ?? null, status: status || "active" }).returning();
    logActivity("game_created", `Game "${name}" created`);
    res.status(201).json({ ...game, createdAt: game.createdAt.toISOString(), registeredCount: 0, claimedCount: 0 });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get("/games/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!DB_AVAILABLE) {
    const game = readGames().find((g) => g.id === id);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    res.json({ ...game, players: undefined, registeredCount: game.players.length, claimedCount: game.players.filter((p) => p.claimed).length });
    return;
  }
  try {
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    const [reg] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id));
    const [cl] = await db.select({ count: count() }).from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.claimed, true)));
    res.json({ ...game, createdAt: game.createdAt.toISOString(), registeredCount: Number(reg?.count ?? 0), claimedCount: Number(cl?.count ?? 0) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.delete("/games/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!DB_AVAILABLE) {
    const games = readGames();
    const idx = games.findIndex((g) => g.id === id);
    if (idx === -1) { res.status(404).json({ error: "Game not found" }); return; }
    const [deleted] = games.splice(idx, 1);
    writeGames(games);
    logActivity("game_deleted", `Game "${deleted.name}" deleted`);
    res.json({ success: true, message: `Game "${deleted.name}" deleted` });
    return;
  }
  try {
    const [deleted] = await db.delete(gamesTable).where(eq(gamesTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Game not found" }); return; }
    logActivity("game_deleted", `Game "${deleted.name}" deleted`);
    res.json({ success: true, message: `Game "${deleted.name}" deleted` });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post("/games/:id/register", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { playerId, playerName } = req.body as { playerId: string; playerName: string };
  if (!playerId || !playerName) { res.status(400).json({ error: "playerId and playerName are required" }); return; }
  if (!DB_AVAILABLE) {
    const games = readGames();
    const game = games.find((g) => g.id === id);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    const existing = game.players.find((p) => p.playerId === playerId);
    if (existing) { res.json({ ...existing }); return; }
    if (game.maxPlayers && game.players.length >= game.maxPlayers) { res.status(400).json({ error: "Game is full" }); return; }
    const player = { id: nextId(game.players), playerId, playerName, claimed: false, claimedAt: null, registeredAt: new Date().toISOString() };
    game.players.push(player);
    writeGames(games);
    res.json(player);
    return;
  }
  try {
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    const [existing] = await db.select().from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.playerId, playerId)));
    if (existing) { res.json({ ...existing, registeredAt: existing.registeredAt.toISOString(), claimedAt: existing.claimedAt?.toISOString() ?? null }); return; }
    if (game.maxPlayers) {
      const [cnt] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id));
      if (Number(cnt?.count ?? 0) >= game.maxPlayers) { res.status(400).json({ error: "Game is full" }); return; }
    }
    const [player] = await db.insert(gamePlayersTable).values({ gameId: id, playerId, playerName }).returning();
    logActivity("game_register", `Player ${playerName} registered for game "${game.name}"`);
    res.json({ ...player, registeredAt: player.registeredAt.toISOString(), claimedAt: null });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post("/games/:id/claim", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { playerId, playerName } = req.body as { playerId: string; playerName?: string };
  if (!playerId) { res.status(400).json({ error: "playerId is required" }); return; }
  if (!DB_AVAILABLE) {
    const games = readGames();
    const game = games.find((g) => g.id === id);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    const player = game.players.find((p) => p.playerId === playerId);
    if (!player) { res.status(404).json({ error: "Player not registered" }); return; }
    if (player.claimed) { res.status(400).json({ error: "Reward already claimed" }); return; }
    player.claimed = true;
    player.claimedAt = new Date().toISOString();
    writeGames(games);
    res.json({ ...player, gameId: id, reward: game.reward });
    return;
  }
  try {
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    const [registration] = await db.select().from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.playerId, playerId)));
    if (!registration) { res.status(404).json({ error: "Player not registered" }); return; }
    if (registration.claimed) { res.status(400).json({ error: "Reward already claimed" }); return; }
    const now = new Date();
    const [updated] = await db.update(gamePlayersTable).set({ claimed: true, claimedAt: now }).where(eq(gamePlayersTable.id, registration.id)).returning();
    logActivity("game_claim", `Player ${playerName || playerId} claimed reward for "${game.name}"`);
    res.json({ id: updated.id, gameId: id, playerId: updated.playerId, playerName: updated.playerName, claimedAt: now.toISOString(), reward: game.reward });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get("/games/:id/players", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!DB_AVAILABLE) {
    const game = readGames().find((g) => g.id === id);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    res.json(game.players);
    return;
  }
  try {
    const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id)).orderBy(desc(gamePlayersTable.registeredAt));
    res.json(players.map((p) => ({ ...p, registeredAt: p.registeredAt.toISOString(), claimedAt: p.claimedAt?.toISOString() ?? null })));
  } catch { res.json([]); }
});

export default router;
