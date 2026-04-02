import { afterEach, describe, expect, it, vi } from "vitest";

const QUERY_CLIENT_MODULE_PATH = "@/lib/query/query-client";

describe("getQueryClient", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("creates a fresh query client on the server with a positive staleTime", async () => {
    const { getQueryClient } = await import(QUERY_CLIENT_MODULE_PATH);

    const firstClient = getQueryClient();
    const secondClient = getQueryClient();

    expect(firstClient).not.toBe(secondClient);
    expect(firstClient.getDefaultOptions().queries?.staleTime).toBe(60 * 1000);
  });
});
