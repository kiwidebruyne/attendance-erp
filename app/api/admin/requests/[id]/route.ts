import {
  createAdminRequestRepository,
  getAdminRequestReviewContext,
} from "@/app/api/admin/requests/_lib/repository";
import { adminRequestDecisionBodySchema } from "@/lib/contracts/requests";
import {
  AdminRequestConflictError,
  AdminRequestNotFoundError,
} from "@/lib/repositories/requests";
import {
  conflictErrorResponse,
  notFoundErrorResponse,
  parseJsonBody,
} from "@/lib/server/api";
import { createRequestLogger } from "@/lib/server/logger";

type AdminRequestRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: AdminRequestRouteContext,
) {
  const { id } = await context.params;
  const requestLogger = createRequestLogger(request, {
    bindings: {
      requestId: id,
    },
  });
  const parsedBody = await parseJsonBody(
    adminRequestDecisionBodySchema,
    request,
  );

  if (!parsedBody.success) {
    requestLogger.warn(
      {
        event: "admin.requests.patch.validation_failed",
      },
      "Rejected invalid admin request decision payload",
    );
    return parsedBody.response;
  }

  requestLogger.info(
    {
      event: "admin.requests.patch",
      requestId: id,
      decision: parsedBody.data.decision,
    },
    "Received admin request decision",
  );

  try {
    const responseBody = createAdminRequestRepository().reviewAdminRequest({
      requestId: id,
      decision: parsedBody.data,
      ...getAdminRequestReviewContext(),
    });

    requestLogger.info(
      {
        event: "admin.requests.patch.succeeded",
        requestId: id,
        decision: parsedBody.data.decision,
        status: responseBody.status,
      },
      "Reviewed admin request",
    );

    return Response.json(responseBody);
  } catch (error) {
    if (error instanceof AdminRequestNotFoundError) {
      requestLogger.warn(
        {
          event: "admin.requests.patch.not_found",
          requestId: id,
          message: error.message,
        },
        "Admin request review target was not found",
      );
      return notFoundErrorResponse(error.message);
    }

    if (error instanceof AdminRequestConflictError) {
      requestLogger.warn(
        {
          event: "admin.requests.patch.conflict",
          requestId: id,
          message: error.message,
        },
        "Admin request review conflicted with the current request chain",
      );
      return conflictErrorResponse(error.message);
    }

    throw error;
  }
}
