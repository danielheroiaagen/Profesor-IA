import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { checkReadiness } from "./check-readiness.mjs";

const DEFAULT_HOSTNAME = "127.0.0.1";
const DEFAULT_PORT = "3000";
const DEFAULT_RETRIES = 30;
const DEFAULT_INTERVAL_MS = 1000;

export async function checkReadinessServer({
  spawnImpl = spawn,
  checkReadinessImpl = checkReadiness,
  sleepImpl = sleep,
  env = process.env,
  platform = process.platform,
  stdout = console.log,
  stderr = console.error,
  hostname = env.READINESS_HOST || DEFAULT_HOSTNAME,
  port = env.READINESS_PORT || env.PORT || DEFAULT_PORT,
  url = env.READINESS_URL || `http://${hostname}:${port}/api/readiness`,
  retries = readPositiveInteger(env.READINESS_RETRIES, DEFAULT_RETRIES),
  intervalMs = readPositiveInteger(
    env.READINESS_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
  ),
} = {}) {
  const child = spawnImpl(
    resolveNpmCommand(platform),
    ["run", "start", "--", "--hostname", hostname, "--port", port],
    {
      env,
      stdio: "ignore",
    },
  );
  let exited = false;

  child.once?.("exit", () => {
    exited = true;
  });
  child.once?.("error", () => {
    exited = true;
  });

  try {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      if (exited) {
        stderr("readiness-server=failed");
        throw new Error("Readiness server smoke failed safely.");
      }

      try {
        const result = await checkReadinessImpl({
          url,
          stdout: noop,
          stderr: noop,
        });

        stdout(`readiness=${result.status} http=${result.httpStatus}`);
        stdout("readiness-server=ready");

        return {
          ok: true,
          attempts: attempt,
          url,
        };
      } catch {
        if (attempt < retries) {
          await sleepImpl(intervalMs);
        }
      }
    }

    stderr("readiness-server=failed");
    throw new Error("Readiness server smoke failed safely.");
  } finally {
    stopServer(child);
  }
}

function resolveNpmCommand(platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stopServer(child) {
  if (!child.killed && typeof child.kill === "function") {
    child.kill("SIGTERM");
  }
}

function noop() {}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkReadinessServer().catch(() => {
    process.exitCode = 1;
  });
}
