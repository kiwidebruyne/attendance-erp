import { createAdminRequestRepository } from "@/app/api/admin/requests/_lib/repository";
import { adminRequestsQuerySchema } from "@/lib/contracts/requests";
import { parseSearchParams } from "@/lib/server/api";
import { createRequestLogger } from "@/lib/server/logger";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = parseSearchParams(adminRequestsQuerySchema, searchParams);

  if (!parsed.success) {
    const requestLogger = createRequestLogger(request, {
      bindings: {
        view: searchParams.get("view") ?? undefined,
      },
    });

    requestLogger.warn(
      {
        event: "admin.requests.validation_failed",
        view: searchParams.get("view") ?? undefined,
      },
      "Rejected invalid admin request query",
    );

    return parsed.response;
  }

  const view = parsed.data.view ?? "needs_review";
  const payload = createAdminRequestRepository().getAdminRequests({
    view,
  });
  const requestLogger = createRequestLogger(request, {
    bindings: {
      view,
    },
  });

  requestLogger.info(
    {
      event: "admin.requests.fetch",
      view,
      itemCount: payload.items.length,
    },
    "Fetched admin requests",
  );

  return Response.json(payload);
}
