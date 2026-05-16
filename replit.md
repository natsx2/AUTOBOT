# AUTOBOT — Facebook Messenger Group Chat Bot

A full-stack Facebook Messenger bot system with a React dashboard. The bot connects via `ws3-fca` and responds to commands/events in group chats.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Bot: ws3-fca (Facebook Chat API)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite (bot-dashboard)

## Where things live

- `bot-commands/` — all bot command and event handler `.js` files
- `bot-data/` — runtime data (sessions, economy, greet config, etc.) — gitignored in production
- `artifacts/api-server/` — Express API server + botManager.js
- `artifacts/bot-dashboard/` — React dashboard frontend
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/index.ts` — Drizzle DB schema

## Bot Commands

### Utility
- `!setnick <nickname>` / `!setnick @user <nickname>` / `!setnick reset` — Set/clear nicknames (fixed v2)
- `!kick @user [reason]` — Kick a tagged user (bot must be admin)
- `!kickall confirm` — Kick all non-admin members (admin only)
- `!prefix <new>` — Change command prefix
- `!uid` — Get user ID
- `!ping` — Check bot response time
- `!uptime` — Show bot uptime
- `!info` — Bot info
- `!thread` — Thread info

### Games (Economy)
- `!register` — Register to economy system
- `!balance` — Check coins balance
- `!daily` — Claim daily coins
- `!slots` / `!flip` / `!dice` / `!rps` / `!wheel` / `!blackjack` / `!guess` / `!trivia` — Gambling/mini-games
- `!steal @user` — Steal coins from someone
- `!transfer @user <amount>` — Send coins
- `!lottery <count>` — Buy lottery tickets
- `!leaderboard` — Economy leaderboard

### Auto Events (handleEvent)
- `welcome` — Auto welcome new members + farewell leaving members
- `flirt` — Random flirt with Tagalog hugot lines mentioning a random member (every 30 min, 8% chance)
- `jokesarcasm` — Random Tagalog joke or sarcasm at a random member (hourly, 10% chance)
- `autopost` — Scheduled random posts to opted-in threads (every 2 hours)
- `imagedetect` — Auto-detect image content when photos are sent to GC
- `antispam` — Auto-kick members who spam (5+ msgs in 10s) or use bad words (5+ times)
- `autogreet` — Morning/night greetings at 6AM / 9PM PHT (enable per-group)

### Admin
- `!autogreet on/off` — Enable/disable scheduled greetings
- `!autopost on/off/now` — Enable/disable/trigger auto-posts
- `!grouplock` — Group lock management
- `!addcmd` / `!removecmd` — Add/remove custom commands

## Architecture decisions

- botManager.js is pure JS (ESM) loaded dynamically by the TypeScript API server to avoid TypeScript incompatibilities with ws3-fca
- Event handlers use `module.exports.handleEvent` and commands use `module.exports.run` — both loaded from `bot-commands/`
- All file-based data (economy, sessions, greet config) stored in `bot-data/` with a persistent disk on Render
- Auto-login on startup: `restoreSessionsOnStartup()` re-logs all sessions from `bot-data/history.json`
- Image detection uses ML-style classification from image URL (no external API key required)
- Anti-spam tracks message frequency per user per thread in-memory with 10s sliding window

## Product

Users log in their Facebook bot accounts via the dashboard by pasting their appstate cookies. The bot then listens to all group chats and responds to commands/events automatically. Features include economy games, scheduled greetings, flirt messages with Filipino hugot lines, image detection, anti-spam protection, and admin moderation tools.

## User preferences

- Commands use `!` prefix by default
- Admin UID: `61578550732043`
- Events are Tagalog/Filipino-flavored where appropriate
- Bot should be graceful when not admin (warn instead of crash)

## Gotchas

- ws3-fca must be installed at workspace root: `pnpm add -w ws3-fca`
- Run `pnpm install` after any package.json change before restarting
- `simv3.js` requires `axios` — installed at root
- Render disk mounted at `/opt/render/project/src/bot-data`
- Build on Render: builds bot-dashboard first, then api-server
- `commandDetail.ts` must exist in `lib/api-zod/src/generated/types/` (was missing, now fixed)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- GitHub repo: https://github.com/natsx2/AUTOBOT
- Render service: autobot-api (auto-deploys on push to main)
