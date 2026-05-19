import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  return raw?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
}

function corsOptions(): CorsOptions {
  const allowed = parseCorsOrigins();
  if (allowed.length > 0) {
    return { origin: allowed };
  }
  return { origin: true };
}

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
app.use(cors(corsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const staticDir = process.env.STATIC_DIR?.trim();
if (staticDir) {
  const resolved = path.resolve(staticDir);
  app.use(express.static(resolved, { index: false }));
  app.get("/*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(resolved, "index.html"));
  });
  logger.info({ staticDir: resolved }, "Serving SPA static assets");
}

export default app;
