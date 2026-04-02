import {
  createEmployeeRequestLogger,
  getCurrentEmployeeId,
} from "@/lib/server/current-employee";
import {
  createMockSeedRepository,
  getMockSeedWorld,
} from "@/lib/server/mock-state";

export async function GET(
  request: Request = new Request("https://example.com/api/attendance/me"),
) {
  const logger = createEmployeeRequestLogger(request);
  const repository = createMockSeedRepository();
  const world = getMockSeedWorld();

  logger.info(
    { event: "attendance.me.fetch" },
    "Fetched employee attendance context",
  );

  return Response.json(
    repository.getEmployeeAttendanceToday({
      employeeId: getCurrentEmployeeId(),
      date: world.baselineDate,
    }),
  );
}
