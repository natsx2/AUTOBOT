import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built React frontend in production
if (process.env.NODE_ENV === "production") {
  // When deployed, the dist is at ../../artifacts/bot-dashboard/dist/public
  // relative to the project root. We try multiple possible locations.
  const candidatePaths = [
    path.resolve(__dirname, "..", "..", "..", "artifacts", "bot-dashboard", "dist", "public"),
    path.resolve(process.cwd(), "artifacts", "bot-dashboard", "dist", "public"),
    path.resolve(__dirname, "public"),
  ];

  const staticDir = candidatePaths.find((p) => fs.existsSync(p));

  if (staticDir) {
    logger.info({ staticDir }, "Serving frontend static files");
    app.use(express.static(staticDir));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    logger.warn("Frontend static files not found; only /api routes are active");
  }
}

// Restore bot sessions on startup (async, non-blocking)
setImmediate(async () => {
  try {
    const botManager = await import("./lib/botManager.js");
    await botManager.restoreSessionsOnStartup();
    logger.info("Bot sessions restored on startup");
  } catch (err) {
    logger.warn({ err }, "Bot session restore skipped (ws3-fca not available)");
  }
});

export default app;
