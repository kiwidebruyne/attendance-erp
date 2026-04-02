import { leaveRequestBodySchema } from "@/lib/contracts/leave";
import {
  buildLeaveRequestResource,
  createLeaveRequest,
  LeaveRequestConflictError,
  LeaveRequestNotFoundError,
  LeaveRequestValidationError,
} from "@/lib/repositories/leave";
import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";
import {
  conflictErrorResponse,
  conflictErrorResponseWithActiveRequestId,
  notFoundErrorResponse,
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/server/api";
import {
  createEmployeeRequestLogger,
  getCurrentEmployeeId,
} from "@/lib/server/current-employee";
import { getMockSeedWorld } from "@/lib/server/mock-state";

export async function POST(request: Request) {
  const parsedBody = await parseJsonBody(leaveRequestBodySchema, request);
  const logger = createEmployeeRequestLogger(request);

  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const employeeId = getCurrentEmployeeId();
  const world = getMockSeedWorld();

  logger.info(
    { event: "leave.request.create" },
    "Received leave create request",
  );

  try {
    const createdRequest = createLeaveRequest(
      world,
      employeeId,
      parsedBody.data,
      buildFixedSeoulDateTime(world.baselineDate, "12:00:00"),
    );
    const responseBody = buildLeaveRequestResource(
      world,
      employeeId,
      createdRequest.id,
    );

    logger.info(
      {
        event: "leave.request.create.succeeded",
        requestId: createdRequest.id,
        rootRequestId: createdRequest.rootRequestId,
      },
      "Created leave request",
    );

    return Response.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof LeaveRequestValidationError) {
      logger.warn(
        {
          event: "leave.request.create.validation_failed",
          message: error.message,
        },
        "Rejected leave create request",
      );
      return validationErrorResponse(error.message);
    }

    if (error instanceof LeaveRequestNotFoundError) {
      logger.warn(
        {
          event: "leave.request.create.not_found",
          message: error.message,
        },
        "Leave parent request was not found",
      );
      return notFoundErrorResponse(error.message);
    }

    if (error instanceof LeaveRequestConflictError) {
      logger.warn(
        {
          event: "leave.request.create.conflict",
          message: error.message,
          activeRequestId: error.activeRequestId,
        },
        "Leave create conflicted with the current request chain",
      );
      return error.activeRequestId === undefined
        ? conflictErrorResponse(error.message)
        : conflictErrorResponseWithActiveRequestId(
            error.message,
            error.activeRequestId,
          );
    }

    throw error;
  }
}
