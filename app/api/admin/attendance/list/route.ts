import { adminAttendanceRepository } from "@/app/api/admin/attendance/_lib/repository";
import { adminAttendanceListQuerySchema } from "@/lib/contracts/admin-attendance";
import { parseSearchParams } from "@/lib/server/api";
import { createRequestLogger } from "@/lib/server/logger";

function normalizeSearchParams(searchParams: URLSearchParams) {
  const normalized = new URLSearchParams();

  for (const [key, value] of searchParams.entries()) {
    normalized.set(key, key === "name" ? value.trim() : value);
  }

  return normalized;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = parseSearchParams(
    adminAttendanceListQuerySchema,
    normalizeSearchParams(searchParams),
  );

  if (!parsed.success) {
    const requestLogger = createRequestLogger(request, {
      bindings: {
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        name: searchParams.get("name")?.trim() || undefined,
      },
    });

    requestLogger.warn(
      {
        event: "admin.attendance.list.validation_failed",
      },
      "Rejected invalid admin attendance list query",
    );

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
