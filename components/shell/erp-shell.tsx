"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ErpShellFrame } from "@/components/shell/erp-shell-frame";

export function ErpShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();

  return <ErpShellFrame pathname={pathname}>{children}</ErpShellFrame>;
}
