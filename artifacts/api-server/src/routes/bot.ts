import { Router, type IRouter } from "express";
import { db, gamesTable, gamePlayersTable, activityLogTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const startedAt = new Date().toISOString();

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
    await botManager.loginAccount(state, prefix || "!", admin ? [admin] : [], commands || [{ commands: [] }, { handleEvent: [] }]);
    logActivity("login", `Bot account ${cUser.value} logged in`, cUser.value);
    res.json({ success: true, message: "Login successful", error: false });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Bot login failed");
    res.status(400).json({ success: false, message: errMsg, error: true });
  }
});

router.delete("/bot/accounts/:userid", async (req, res): Promise<void> => {
  const userid = Array.isArray(req.params.userid) ? req.params.userid[0] : req.params.userid;
  try {
    const botManager = await import("../lib/botManager.js");
    const account = botManager.getAccount(userid);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    await botManager.logoutAccount(userid);
    logActivity("logout", `Bot account ${userid} logged out`, userid);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
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

router.get("/bot/stats", async (_req, res): Promise<void> => {
  const now = Date.now();
  const started = new Date(startedAt).getTime();
  const uptime = Math.floor((now - started) / 1000);
  try {
    const botManager = await import("../lib/botManager.js");
    const accounts = botManager.getAccounts();
    const { commands, handleEvent } = botManager.getCommands();
    const [gamesCount] = await db.select({ count: count() }).from(gamesTable);
    res.json({
      uptime,
      accountsOnline: accounts.length,
      totalCommands: commands.length + handleEvent.length,
      totalGames: Number(gamesCount?.count ?? 0),
      startedAt,
    });
  } catch {
    res.json({ uptime, accountsOnline: 0, totalCommands: 0, totalGames: 0, startedAt });
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
    name: string;
    description: string;
    reward: string;
    maxPlayers?: number;
    status?: string;
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
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  const [regCount] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id));
  const [claimCount] = await db.select({ count: count() }).from(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.claimed, true)));
  res.json({
    ...game,
    createdAt: game.createdAt.toISOString(),
    registeredCount: Number(regCount?.count ?? 0),
    claimedCount: Number(claimCount?.count ?? 0),
  });
});

router.delete("/games/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [deleted] = await db.delete(gamesTable).where(eq(gamesTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  logActivity("game_deleted", `Game "${deleted.name}" deleted`);
  res.json({ success: true, message: `Game "${deleted.name}" deleted` });
});

router.post("/games/:id/register", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { playerId, playerName } = req.body as { playerId: string; playerName: string };
  if (!playerId || !playerName) {
    res.status(400).json({ error: "playerId and playerName are required" });
    return;
  }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(gamePlayersTable)
    .where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.playerId, playerId)));
  if (existing) {
    res.json({ ...existing, registeredAt: existing.registeredAt.toISOString(), claimedAt: existing.claimedAt?.toISOString() ?? null });
    return;
  }
  if (game.maxPlayers) {
    const [cnt] = await db.select({ count: count() }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, id));
    if (Number(cnt?.count ?? 0) >= game.maxPlayers) {
      res.status(400).json({ error: "Game is full" });
      return;
    }
  }
  const [player] = await db.insert(gamePlayersTable).values({ gameId: id, playerId, playerName }).returning();
  logActivity("game_register", `Player ${playerName} registered for game "${game.name}"`);
  res.json({ ...player, registeredAt: player.registeredAt.toISOString(), claimedAt: null });
});

router.post("/games/:id/claim", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { playerId, playerName } = req.body as { playerId: string; playerName?: string };
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  const [registration] = await db
    .select()
    .from(gamePlayersTable)
    .where(and(eq(gamePlayersTable.gameId, id), eq(gamePlayersTable.playerId, playerId)));
  if (!registration) {
    res.status(404).json({ error: "Player not registered for this game" });
    return;
  }
  if (registration.claimed) {
    res.status(400).json({ error: "Reward already claimed" });
    return;
  }
  const now = new Date();
  const [updated] = await db
    .update(gamePlayersTable)
    .set({ claimed: true, claimedAt: now })
    .where(eq(gamePlayersTable.id, registration.id))
    .returning();
  logActivity("game_claim", `Player ${playerName || playerId} claimed reward for "${game.name}"`);
  res.json({
    id: updated.id,
    gameId: id,
    playerId: updated.playerId,
    playerName: updated.playerName,
    claimedAt: now.toISOString(),
    reward: game.reward,
  });
});

router.get("/games/:id/players", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.gameId, id))
    .orderBy(desc(gamePlayersTable.registeredAt));
  res.json(players.map((p) => ({ ...p, registeredAt: p.registeredAt.toISOString(), claimedAt: p.claimedAt?.toISOString() ?? null })));
});

export default router;
