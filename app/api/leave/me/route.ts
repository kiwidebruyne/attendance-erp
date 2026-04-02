import { leaveOverviewQuerySchema } from "@/lib/contracts/leave";
import { parseSearchParams } from "@/lib/server/api";
import {
  createEmployeeRequestLogger,
  getCurrentEmployeeId,
} from "@/lib/server/current-employee";
import { createMockSeedRepository } from "@/lib/server/mock-state";

export async function GET(
  request: Request = new Request("https://example.com/api/leave/me"),
) {
  const parsedQuery = parseSearchParams(
    leaveOverviewQuerySchema,
    new URL(request.url).searchParams,
  );

  if (!parsedQuery.success) {
    return parsedQuery.response;
  }

  createEmployeeRequestLogger(request).info(
    { event: "leave.me.fetch" },
    "Fetched employee leave overview",
  );

  return Response.json(
    createMockSeedRepository().getEmployeeLeaveOverview({
      employeeId: getCurrentEmployeeId(),
      date: parsedQuery.data.date,
    }),
  );
}
