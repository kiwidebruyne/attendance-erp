import { leaveRequestPatchBodySchema } from "@/lib/contracts/leave";
import {
  buildLeaveRequestResource,
  LeaveRequestConflictError,
  LeaveRequestNotFoundError,
  LeaveRequestValidationError,
  updateLeaveRequest,
} from "@/lib/repositories/leave";
import {
  conflictErrorResponse,
  notFoundErrorResponse,
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/server/api";
import {
  createEmployeeRequestLogger,
  getCurrentEmployeeId,
} from "@/lib/server/current-employee";
import { getMockSeedWorld } from "@/lib/server/mock-state";

type LeaveRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: LeaveRouteContext) {
  const parsedBody = await parseJsonBody(leaveRequestPatchBodySchema, request);
  const logger = createEmployeeRequestLogger(request);

  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { id } = await context.params;
  const employeeId = getCurrentEmployeeId();
  const world = getMockSeedWorld();

  logger.info(
    { event: "leave.request.patch", requestId: id },
    "Received leave patch request",
  );

  try {
    const updatedRequest = updateLeaveRequest(
      world,
      employeeId,
      id,
      parsedBody.data,
    );
    const responseBody = buildLeaveRequestResource(
      world,
      employeeId,
      updatedRequest.id,
    );

    logger.info(
      {
        event: "leave.request.patch.succeeded",
        requestId: updatedRequest.id,
        status: updatedRequest.status,
      },
      "Updated leave request",
    );

    return Response.json(responseBody);
  } catch (error) {
    if (error instanceof LeaveRequestValidationError) {
      logger.warn(
        {
          event: "leave.request.patch.validation_failed",
          requestId: id,
          message: error.message,
        },
        "Rejected leave patch request",
      );
      return validationErrorResponse(error.message);
    }

    if (error instanceof LeaveRequestNotFoundError) {
      logger.warn(
        {
          event: "leave.request.patch.not_found",
          requestId: id,
          message: error.message,
        },
        "Leave patch target was not found",
      );
      return notFoundErrorResponse(error.message);
    }

    if (error instanceof LeaveRequestConflictError) {
      logger.warn(
        {
          event: "leave.request.patch.conflict",
          requestId: id,
          message: error.message,
        },
        "Leave patch conflicted with the current request chain",
      );
      return conflictErrorResponse(error.message);
    }

    throw error;
  }
}
