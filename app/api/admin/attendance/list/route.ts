import { adminAttendanceRepository } from "@/app/api/admin/attendance/_lib/repository";
import { adminAttendanceListQuerySchema } from "@/lib/contracts/admin-attendance";
import { parseSearchParams } from "@/lib/server/api";
import { createRequestLogger } from "@/lib/server/logger";

export async function GET(request: Request) {
  const parsed = parseSearchParams(
    adminAttendanceListQuerySchema,
    new URL(request.url).searchParams,
  );

  if (!parsed.success) {
    return parsed.response;
  }

  const { from, to, name } = parsed.data;
  const payload = adminAttendanceRepository.getAdminAttendanceList({
    from,
    to,
    name,
  });
  const bindings = {
    from,
    to,
    ...(name === undefined ? {} : { name }),
  };
  const requestLogger = createRequestLogger(request, {
    bindings,
  });

  requestLogger.info(
    {
      event: "admin.attendance.list.fetch",
      ...bindings,
    },
    "Fetched admin attendance list",
  );

  return Response.json(payload);
}
