import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

// @ts-expect-error - Runtime-tested JavaScript smoke script has no TS declarations.
import { checkReadinessServer } from "../../scripts/check-readiness-server.mjs";

const OPENAI_SECRET = "sk-test-primary-key-never-returned";

describe("check-readiness-server", () => {
  it("starts the production server and polls readiness until ready", async () => {
    const child = createFakeChild();
    const spawnImpl = vi.fn(() => child);
    const checkReadinessImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("not ready yet"))
      .mockResolvedValueOnce({ ok: true, status: "ready", httpStatus: 200 });
    const stdout = vi.fn();
    const stderr = vi.fn();

    const result = await checkReadinessServer({
      spawnImpl,
      checkReadinessImpl,
      sleepImpl: vi.fn(async () => undefined),
      env: { HOSTNAME: "ci-runner-hostname" },
      stdout,
      stderr,
      intervalMs: 1,
      retries: 2,
    });

    expect(result).toEqual({
      ok: true,
      attempts: 2,
      url: "http://127.0.0.1:3000/api/readiness",
    });
    expect(spawnImpl).toHaveBeenCalledWith(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"],
      { env: { HOSTNAME: "ci-runner-hostname" }, stdio: "ignore" },
    );
    expect(stdout).toHaveBeenCalledWith("readiness=ready http=200");
    expect(stdout).toHaveBeenCalledWith("readiness-server=ready");
    expect(stderr).not.toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("fails safely without leaking readiness errors", async () => {
    const child = createFakeChild();
    const stdout = vi.fn();
    const stderr = vi.fn();

    await expect(
      checkReadinessServer({
        spawnImpl: vi.fn(() => child),
        checkReadinessImpl: vi.fn(async () => {
          throw new Error(`not ready ${OPENAI_SECRET}`);
        }),
        sleepImpl: vi.fn(async () => undefined),
        env: {},
        stdout,
        stderr,
        intervalMs: 1,
        retries: 2,
      }),
    ).rejects.toThrow("Readiness server smoke failed safely.");

    expect(stderr).toHaveBeenCalledWith("readiness-server=failed");
    expect(
      JSON.stringify([...stdout.mock.calls, ...stderr.mock.calls]),
    ).not.toContain(OPENAI_SECRET);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
});

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
  };

  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    return true;
  });

  return child;
}
