import { attendanceHistoryQuerySchema } from "@/lib/contracts/attendance";
import { parseSearchParams } from "@/lib/server/api";
import {
  createEmployeeRequestLogger,
  getCurrentEmployeeId,
} from "@/lib/server/current-employee";
import { createMockSeedRepository } from "@/lib/server/mock-state";

export async function GET(request: Request) {
  const parsedQuery = parseSearchParams(
    attendanceHistoryQuerySchema,
    new URL(request.url).searchParams,
  );

  if (!parsedQuery.success) {
    return parsedQuery.response;
  }

  createEmployeeRequestLogger(request).info(
    { event: "attendance.history.fetch" },
    "Fetched employee attendance history",
  );

  return Response.json(
    createMockSeedRepository().getEmployeeAttendanceHistory({
      employeeId: getCurrentEmployeeId(),
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
    }),
  );
}
