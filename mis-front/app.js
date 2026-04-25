const http = require("http");
const fs = require("fs");
const next = require("next");
const path = require("path");
const util = require("util");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || process.env.APP_HOST || "127.0.0.1";
const dev = process.env.NODE_ENV !== "production";
const debugStartupErrors = process.env.PASSENGER_DEBUG_ERRORS === "true";
const logsDir = path.join(__dirname, "logs");
const startupLogFile = path.join(logsDir, "passenger-startup.log");

let appServerStarted = false;
let fallbackServerStarted = false;

function formatError(error) {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }

  return typeof error === "string" ? error : util.inspect(error, { depth: 5 });
}

function writeStartupLog(label, error) {
  const details = formatError(error);
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${label}\n${details}\n\n`;

  try {
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(startupLogFile, message, "utf8");
  } catch (logError) {
    console.error("Failed to write Passenger startup log.", logError);
  }

  return details;
}

function handleStartupFailure(label, error) {
  const details = writeStartupLog(label, error);
  console.error(label, error);

  if (debugStartupErrors && !appServerStarted && !fallbackServerStarted) {
    fallbackServerStarted = true;

    http
      .createServer((_req, res) => {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(`${label}\n\n${details}\n`);
      })
      .listen(port, hostname, () => {
        console.error(`Passenger debug error server listening on http://${hostname}:${port}`);
      });

    return;
  }

  process.exit(1);
}

process.on("uncaughtException", (error) => {
  handleStartupFailure("Uncaught exception while starting Next.js under Passenger.", error);
});

process.on("unhandledRejection", (reason) => {
  handleStartupFailure("Unhandled rejection while starting Next.js under Passenger.", reason);
});

console.log("Starting Next.js under Passenger.", {
  node: process.version,
  env: process.env.NODE_ENV,
  port,
  hostname,
});

const app = next({
  dev,
  dir: __dirname,
  hostname,
  port,
});

const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http.createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
      appServerStarted = true;
      console.log(`Next.js app listening on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    handleStartupFailure("Failed to start Next.js under Passenger.", error);
  });
