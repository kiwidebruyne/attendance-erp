import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { createLogger, createRequestLogger } from "@/lib/server/logger";

describe("server logger", () => {
  const streams: PassThrough[] = [];

  afterEach(() => {
    for (const stream of streams) {
      stream.end();
    }
  });

  it("binds request metadata and extra context into structured log lines", async () => {
    const stream = new PassThrough();
    streams.push(stream);

    const lines: string[] = [];

    stream.on("data", (chunk: Buffer | string) => {
      lines.push(chunk.toString().trim());
    });

    const logger = createLogger(stream);
    const requestLogger = createRequestLogger(
      new Request("https://example.com/api/attendance/me?view=today", {
        headers: {
          "x-request-id": "req_123",
        },
      }),
      {
        logger,
        bindings: {
          employeeId: "emp_001",
        },
      },
    );

    requestLogger.info(
      { event: "attendance.fetch" },
      "Fetched attendance context",
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const entry = JSON.parse(lines[0]);

    expect(entry.requestId).toBe("req_123");
    expect(entry.method).toBe("GET");
    expect(entry.pathname).toBe("/api/attendance/me");
    expect(entry.employeeId).toBe("emp_001");
    expect(entry.event).toBe("attendance.fetch");
    expect(entry.msg).toBe("Fetched attendance context");
  });
});
