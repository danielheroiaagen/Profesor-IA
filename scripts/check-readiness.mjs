const DEFAULT_READINESS_URL = "http://localhost:3000/api/readiness";
const READY_STATUS = "ready";

export async function checkReadiness({
  url = process.env.READINESS_URL || DEFAULT_READINESS_URL,
  fetchImpl = globalThis.fetch,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  if (typeof fetchImpl !== "function") {
    stderr("readiness=unavailable http=0");
    throw new Error("Readiness check failed safely.");
  }

  let response;

  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    stderr("readiness=unavailable http=0");
    throw new Error("Readiness check failed safely.");
  }

  const body = await readJsonSafely(response);
  const readinessStatus = readStatus(body);
  const line = `readiness=${readinessStatus} http=${response.status}`;

  if (response.ok && readinessStatus === READY_STATUS) {
    stdout(line);
    return {
      ok: true,
      status: readinessStatus,
      httpStatus: response.status,
    };
  }

  stderr(line);
  throw new Error("Readiness check failed safely.");
}

async function readJsonSafely(response) {
  try {
    const data = await response.json();
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

function readStatus(body) {
  return typeof body.status === "string" && body.status.trim()
    ? body.status.trim()
    : "unknown";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkReadiness().catch(() => {
    process.exitCode = 1;
  });
}
