import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Providers } from "@/app/(erp)/providers";
import { getQueryClient } from "@/lib/query/query-client";
import { ReactQueryProviderProbe } from "@/tests/fixtures/react-query-provider-probe";

afterEach(() => {
  getQueryClient().clear();
});

describe("ERP providers", () => {
  it("reuses a singleton query client in the browser runtime", () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it("lets client components use React Query under the shared ERP boundary", async () => {
    render(
      <Providers>
        <ReactQueryProviderProbe />
      </Providers>,
    );

    expect(await screen.findByText("provider-ready")).toBeInTheDocument();
  });
});
