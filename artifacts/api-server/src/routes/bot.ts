import { Router, type IRouter } from "express";
import { db, gamesTable, gamePlayersTable, activityLogTable, usersTable } from "@workspace/db";
import { eq, desc, count, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const startedAt = new Date().toISOString();

// Economy data helpers (file-based for command compatibility)
const WORKSPACE_ROOT = path.resolve(process.cwd());
const BOT_DATA_DIR = process.env.BOT_DATA_DIR || path.join(WORKSPACE_ROOT, "bot-data");

function getEconomy() {
  const file = path.join(BOT_DATA_DIR, "economy.json");
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return { users: {} }; }
}

function logActivity(type: string, message: string, userid?: string) {
  db.insert(activityLogTable)
    .values({ type, message, userid: userid ?? null })
    .catch((err: Error) => logger.error({ err }, "Failed to log activity"));
}

router.get("/bot/accounts", async (_req, res): Promise<void> => {
  try {
    const botManager = await import("../lib/botManager.js");
    const accounts = botManager.getAccounts();
    res.json(accounts);
  } catch {
    res.json([]);
  }
});

router.post("/bot/login", async (req, res): Promise<void> => {
  const { state, prefix, admin, commands } = req.body;
  if (!state || !Array.isArray(state)) {
    res.status(400).json({ error: "Invalid appstate", success: false, message: "Missing or invalid appstate data" });
    return;
  }
  const cUser = (state as Array<{ key: string; value: string }>).find((item) => item.key === "c_user");
  if (!cUser) {
    res.status(400).json({ error: "No c_user in appstate", success: false, message: "Invalid appstate: missing c_user cookie" });
    return;
  }
  try {
    const botManager = await import("../lib/botManager.js");
    const existing = botManager.getAccount(cUser.value);
    if (existing) {
      res.status(400).json({ success: false, message: "Account already logged in", error: false });
      return;
    }
    // Default: empty commands = all commands enabled
    const accessKey = typeof req.body.accessKey === "string" && req.body.accessKey.trim() ? req.body.accessKey.trim() : undefined;
    await botManager.loginAccount(state, prefix || "!", admin ? [admin] : [], commands || [{ commands: [] }, { handleEvent: [] }], accessKey);
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
    const botManager = await import("../lib/botManager.js");
    const result = botManager.getAccountEnabledCommands(userid);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/bot/accounts/:userid/commands", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  const { commands, handleEvent } = req.body as { commands: string[]; handleEvent: string[] };
  try {
    const botManager = await import("../lib/botManager.js");
    botManager.updateAccountCommands(userid, commands || [], handleEvent || []);
    logActivity("config", `Commands updated for account ${userid}`, userid);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/bot/accounts/:userid", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  const accessKey = typeof req.body?.accessKey === "string" ? req.body.accessKey.trim() : undefined;
  try {
    const botManager = await import("../lib/botManager.js");
    const account = botManager.getAccount(userid);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    await botManager.logoutAccount(userid, accessKey);
    logActivity("logout", `Bot account ${userid} logged out`, userid);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === "ACCESS_KEY_REQUIRED") {
      res.status(403).json({ error: "Access key required to logout this bot", code: "ACCESS_KEY_REQUIRED" });
      return;
    }
    if (errMsg === "INVALID_ACCESS_KEY") {
      res.status(403).json({ error: "Invalid access key", code: "INVALID_ACCESS_KEY" });
      return;
    }
    res.status(500).json({ error: errMsg });
  }
});

router.get("/bot/commands", async (_req, res): Promise<void> => {
  try {
    const botManager = await import("../lib/botManager.js");
    const { commands, handleEvent, commandDetails, handleEventDetails } = botManager.getCommands();
    res.json({
      commands,
      handleEvent,
      commandDetails: commandDetails ?? [],
      handleEventDetails: handleEventDetails ?? [],
      total: commands.length + handleEvent.length,
    });
  } catch {
    res.json({ commands: [], handleEvent: [], commandDetails: [], handleEventDetails: [], total: 0 });
  }
});

// Reload commands (called by addcmd/removecmd bot commands)
router.post("/bot/commands/reload", async (_req, res): Promise<void> => {
  try {
    const botManager = await import("../lib/botManager.js");
    botManager.loadCommands();
    res.json({ success: true, message: "Commands reloaded" });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

// Add custom command via dashboard
router.post("/bot/commands/custom", async (req, res): Promise<void> => {
  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "code is required" }); return; }
  try {
    const botManager = await import("../lib/botManager.js");
    const name = botManager.addCustomCommand("", code);
    logActivity("cmd_add", `Custom command "${name}" added`);
    res.json({ success: true, name });
  } catch (err: unknown) {
    res.status(400).json({ error: String(err) });
  }
});

// Remove custom command via dashboard
router.delete("/bot/commands/custom/:name", async (req, res): Promise<void> => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  try {
    const botManager = await import("../lib/botManager.js");
    botManager.removeCustomCommand(name);
    logActivity("cmd_remove", `Custom command "${name}" removed`);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(404).json({ error: String(err) });
  }
});

// Get custom commands list
router.get("/bot/commands/custom", async (_req, res): Promise<void> => {
  try {
    const botManager = await import("../lib/botManager.js");
    const list = botManager.getCustomCommands();
    res.json(list);
  } catch {
    res.json([]);
  }
});

router.get("/bot/stats", async (_req, res): Promise<void> => {
  const now = Date.now();
  const started = new Date(startedAt).getTime();
  const uptime = Math.floor((now - started) / 1000);
  try {
    const botManager = await import("../lib/botManager.js");
    const accounts = botManager.getAccounts();
    const { commands, handleEvent } = botManager.getCommands();
    const [gamesCount] = await db.select({ count: count() }).from(gamesTable);
    const eco = getEconomy();
    const userCount = Object.keys(eco.users || {}).length;
    res.json({
      uptime,
      accountsOnline: accounts.length,
      totalCommands: commands.length + handleEvent.length,
      totalGames: Number(gamesCount?.count ?? 0),
      totalUsers: userCount,
      startedAt,
    });
  } catch {
    res.json({ uptime, accountsOnline: 0, totalCommands: 0, totalGames: 0, totalUsers: 0, startedAt });
  }
});

router.get("/bot/activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(activityLogTable)
    .orderBy(desc(activityLogTable.timestamp))
    .limit(50);
  res.json(rows.map((r) => ({ ...r, timestamp: r.timestamp.toISOString() })));
});

// Economy routes
router.get("/economy/users", async (_req, res): Promise<void> => {
  const eco = getEconomy();
  const users = Object.entries(eco.users || {}).map(([id, u]: [string, any]) => ({
    userid: id,
    name: u.name,
    balance: u.balance,
    lastClaim: u.lastClaim,
    registeredAt: u.registeredAt,
  })).sort((a, b) => b.balance - a.balance);
  res.json(users);
});

router.get("/economy/users/:userid", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  const eco = getEconomy();
  const user = eco.users?.[userid];
  if (!user) { res.status(404).json({ error: "User not registered" }); return; }
  res.json({ userid, ...user });
});

// Games routes
router.get("/games", async (_req, res): Promise<void> => {
  const games = await db.select().from(gamesTable).orderBy(desc(gamesTable.createdAt));
  const result = await Promise.all(
    games.map(async (game) => {
      const [regCount] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, game.id));
      const [claimCount] = await db.select({ count: count() }).from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, game.id), eq(gamePlayersTable.claimed, true)));
      return {
        ...game,
        createdAt: game.createdAt.toISOString(),
        registeredCount: Number(regCount?.count ?? 0),
        claimedCount: Number(claimCount?.count ?? 0),
      };
    })
  );
  res.json(result);
});

router.post("/games", async (req, res): Promise<void> => {
  const { name, description, reward, maxPlayers, status } = req.body as {
    name: string; description: string; reward: string; maxPlayers?: number; status?: string;
  };
  if (!name || !description || !reward) {
    res.status(400).json({ error: "name, description, and reward are required" });
    return;
  }
  const [game] = await db
    .insert(gamesTable)
    .values({ name, description, reward, maxPlayers: maxPlayers ?? null, status: status || "active" })
    .returning();
  logActivity("game_created", `Game "${name}" created`);
  res.status(201).json({ ...game, createdAt: game.createdAt.toISOString(), registeredCount: 0, claimedCount: 0 });
});

router.get("/games/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Game not found" }); return; }
  const [regCount] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id));
  const [claimCount] = await db.select({ count: count() }).from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.claimed, true)));
  res.json({ ...game, createdAt: game.createdAt.toISOString(), registeredCount: Number(regCount?.count ?? 0), claimedCount: Number(claimCount?.count ?? 0) });
});

router.delete("/games/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [deleted] = await db.delete(gamesTable).where(eq(gamesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Game not found" }); return; }
  logActivity("game_deleted", `Game "${deleted.name}" deleted`);
  res.json({ success: true, message: `Game "${deleted.name}" deleted` });
});

router.post("/games/:id/register", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { playerId, playerName } = req.body as { playerId: string; playerName: string };
  if (!playerId || !playerName) { res.status(400).json({ error: "playerId and playerName are required" }); return; }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Game not found" }); return; }
  const [existing] = await db.select().from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.playerId, playerId)));
  if (existing) {
    res.json({ ...existing, registeredAt: existing.registeredAt.toISOString(), claimedAt: existing.claimedAt?.toISOString() ?? null });
    return;
  }
  if (game.maxPlayers) {
    const [cnt] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id));
    if (Number(cnt?.count ?? 0) >= game.maxPlayers) { res.status(400).json({ error: "Game is full" }); return; }
  }
  const [player] = await db.insert(gamePlayersTable).values({ gameId: id, playerId, playerName }).returning();
  logActivity("game_register", `Player ${playerName} registered for game "${game.name}"`);
  res.json({ ...player, registeredAt: player.registeredAt.toISOString(), claimedAt: null });
});

router.post("/games/:id/claim", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { playerId, playerName } = req.body as { playerId: string; playerName?: string };
  if (!playerId) { res.status(400).json({ error: "playerId is required" }); return; }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Game not found" }); return; }
  const [registration] = await db.select().from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.playerId, playerId)));
  if (!registration) { res.status(404).json({ error: "Player not registered for this game" }); return; }
  if (registration.claimed) { res.status(400).json({ error: "Reward already claimed" }); return; }
  const now = new Date();
  const [updated] = await db.update(gamePlayersTable).set({ claimed: true, claimedAt: now }).where(eq(gamePlayersTable.id, registration.id)).returning();
  logActivity("game_claim", `Player ${playerName || playerId} claimed reward for "${game.name}"`);
  res.json({ id: updated.id, gameId: id, playerId: updated.playerId, playerName: updated.playerName, claimedAt: now.toISOString(), reward: game.reward });
});

router.get("/games/:id/players", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id)).orderBy(desc(gamePlayersTable.registeredAt));
  res.json(players.map((p) => ({ ...p, registeredAt: p.registeredAt.toISOString(), claimedAt: p.claimedAt?.toISOString() ?? null })));
});

export default router;
