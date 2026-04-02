import { manualAttendanceRequestPatchBodySchema } from "@/lib/contracts/attendance";
import {
  buildManualAttendanceRequestResource,
  ManualAttendanceConflictError,
  ManualAttendanceNotFoundError,
  ManualAttendanceValidationError,
  updateManualAttendanceRequest,
} from "@/lib/repositories/manual-attendance";
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

type ManualAttendanceRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: ManualAttendanceRouteContext,
) {
  const parsedBody = await parseJsonBody(
    manualAttendanceRequestPatchBodySchema,
    request,
  );
  const logger = createEmployeeRequestLogger(request);

  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { id } = await context.params;
  const employeeId = getCurrentEmployeeId();
  const world = getMockSeedWorld();

  logger.info(
    { event: "attendance.manual.patch", requestId: id },
    "Received manual attendance patch request",
  );

  try {
    const updatedRequest = updateManualAttendanceRequest(
      world,
      employeeId,
      id,
      parsedBody.data,
    );
    const responseBody = buildManualAttendanceRequestResource(
      world,
      employeeId,
      updatedRequest.id,
    );

    logger.info(
      {
        event: "attendance.manual.patch.succeeded",
        requestId: updatedRequest.id,
        status: updatedRequest.status,
      },
      "Updated manual attendance request",
    );

    return Response.json(responseBody);
  } catch (error) {
    if (error instanceof ManualAttendanceValidationError) {
      logger.warn(
        {
          event: "attendance.manual.patch.validation_failed",
          requestId: id,
          message: error.message,
        },
        "Rejected manual attendance patch request",
      );
      return validationErrorResponse(error.message);
    }

    if (error instanceof ManualAttendanceNotFoundError) {
      logger.warn(
        {
          event: "attendance.manual.patch.not_found",
          requestId: id,
          message: error.message,
        },
        "Manual attendance patch target was not found",
      );
      return notFoundErrorResponse(error.message);
    }

    if (error instanceof ManualAttendanceConflictError) {
      logger.warn(
        {
          event: "attendance.manual.patch.conflict",
          requestId: id,
          message: error.message,
        },
        "Manual attendance patch conflicted with the current request chain",
      );
      return conflictErrorResponse(error.message);
    }

    throw error;
  }
}
