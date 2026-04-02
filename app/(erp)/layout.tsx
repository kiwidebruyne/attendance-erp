import type { ReactNode } from "react";

import { Providers } from "@/app/(erp)/providers";
import { ErpShell } from "@/components/shell/erp-shell";

export default function ErpLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ErpShell>
      <Providers>{children}</Providers>
    </ErpShell>
  );
}
