import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typedRoutes: true,
  turbopack: {
    root: rootDirectory,
  },
};

export default nextConfig;
