import {
  createAdminAttendanceRepository,
  getAdminAttendanceBaselineDate,
} from "@/app/api/admin/attendance/_lib/repository";
import { createRequestLogger } from "@/lib/server/logger";

export async function GET(request: Request) {
  const date = getAdminAttendanceBaselineDate();
  const payload = createAdminAttendanceRepository().getAdminAttendanceToday({
    date,
  });
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

  return Response.json(payload);
}
