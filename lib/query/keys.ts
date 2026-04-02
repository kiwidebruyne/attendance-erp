import type { RequestQueueView } from "@/lib/contracts/shared";

export const queryKeys = {
  adminAttendance: {
    all: ["adminAttendance"] as const,
  },
  adminRequests: {
    all: ["adminRequests"] as const,
    byView: (view: RequestQueueView) => ["adminRequests", view] as const,
  },
  attendance: {
    all: ["attendance"] as const,
  },
  leave: {
    all: ["leave"] as const,
  },
} as const;
