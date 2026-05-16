import { pgTable, text, serial, integer, boolean, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  reward: text("reward").notNull(),
  status: text("status").notNull().default("active"),
  maxPlayers: integer("max_players"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const gamePlayersTable = pgTable("game_players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  userid: text("userid"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("bot_users", {
  id: serial("id").primaryKey(),
  userid: text("userid").notNull().unique(),
  name: text("name").notNull(),
  balance: bigint("balance", { mode: "number" }).notNull().default(500),
  lastClaim: timestamp("last_claim", { withTimezone: true }),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGamePlayerSchema = createInsertSchema(gamePlayersTable).omit({ id: true, registeredAt: true });
export const insertActivitySchema = createInsertSchema(activityLogTable).omit({ id: true, timestamp: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, registeredAt: true });

export type Game = typeof gamesTable.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GamePlayer = typeof gamePlayersTable.$inferSelect;
export type InsertGamePlayer = z.infer<typeof insertGamePlayerSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;
export type BotUser = typeof usersTable.$inferSelect;
export type InsertBotUser = z.infer<typeof insertUserSchema>;
