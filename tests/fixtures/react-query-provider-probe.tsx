"use client";

import { useQuery } from "@tanstack/react-query";

export function ReactQueryProviderProbe() {
  const { data, status } = useQuery({
    queryKey: ["probe"],
    queryFn: async () => "provider-ready",
  });

  return (
    <div>
      <span>{status}</span>
      <span>{data ?? "no-data"}</span>
    </div>
  );
}
