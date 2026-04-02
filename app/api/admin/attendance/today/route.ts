import { adminAttendanceRepository } from "@/app/api/admin/attendance/_lib/repository";
import { canonicalSeedWorld } from "@/lib/seed/world";
import { createRequestLogger } from "@/lib/server/logger";

export async function GET(request: Request) {
  const date = canonicalSeedWorld.baselineDate;
  const requestLogger = createRequestLogger(request, {
    bindings: {
      date,
    },
  });

  requestLogger.info(
    {
      event: "admin.attendance.today.fetch",
      date,
    },
    "Fetched admin attendance today",
  );

  return Response.json(
    adminAttendanceRepository.getAdminAttendanceToday({ date }),
  );
}
