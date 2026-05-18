import app from "./app";
import { logger } from "./lib/logger";

const defaultPort =
  process.env.NODE_ENV === "development"
    ? "3001"
    : process.env.STATIC_DIR?.trim()
      ? "3000"
      : "3001";

const rawPort = process.env["PORT"] ?? defaultPort;
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
