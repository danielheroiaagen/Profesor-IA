import { describe, expect, it, vi } from "vitest";

// @ts-expect-error - Runtime-tested JavaScript smoke script has no TS declarations.
import { checkReadiness } from "../../scripts/check-readiness.mjs";

const OPENAI_SECRET = "sk-test-primary-key-never-returned";

describe("check-readiness", () => {
  it("prints safe success output for ready responses", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const result = await checkReadiness({
      fetchImpl: vi.fn(async () => Response.json({ status: "ready" })),
      stdout,
      stderr,
    });

    expect(result).toEqual({
      ok: true,
      status: "ready",
      httpStatus: 200,
    });
    expect(stdout).toHaveBeenCalledWith("readiness=ready http=200");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("fails safely for degraded responses without leaking response details", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    await expect(
      checkReadiness({
        fetchImpl: vi.fn(async () =>
          Response.json(
            {
              status: "degraded",
              unsafe: OPENAI_SECRET,
            },
            { status: 503 },
          ),
        ),
        stdout,
        stderr,
      }),
    ).rejects.toThrow("Readiness check failed safely.");

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith("readiness=degraded http=503");
    expect(JSON.stringify(stderr.mock.calls)).not.toContain(OPENAI_SECRET);
  });

  it("fails safely when the endpoint is unavailable", async () => {
    const stderr = vi.fn();

    await expect(
      checkReadiness({
        fetchImpl: vi.fn(async () => {
          throw new Error(`network failed ${OPENAI_SECRET}`);
        }),
        stderr,
      }),
    ).rejects.toThrow("Readiness check failed safely.");

    expect(stderr).toHaveBeenCalledWith("readiness=unavailable http=0");
    expect(JSON.stringify(stderr.mock.calls)).not.toContain(OPENAI_SECRET);
  });
});
