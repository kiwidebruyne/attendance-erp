import { manualAttendanceRequestBodySchema } from "@/lib/contracts/attendance";
import {
  buildManualAttendanceRequestResource,
  createManualAttendanceRequest,
  ManualAttendanceConflictError,
  ManualAttendanceNotFoundError,
  ManualAttendanceValidationError,
} from "@/lib/repositories/manual-attendance";
import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";
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

export async function POST(request: Request) {
  const parsedBody = await parseJsonBody(
    manualAttendanceRequestBodySchema,
    request,
  );
  const logger = createEmployeeRequestLogger(request);

  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const employeeId = getCurrentEmployeeId();
  const world = getMockSeedWorld();

  logger.info(
    { event: "attendance.manual.create" },
    "Received manual attendance create request",
  );

  try {
    const createdRequest = createManualAttendanceRequest(
      world,
      employeeId,
      parsedBody.data,
      buildFixedSeoulDateTime(world.baselineDate, "12:00:00"),
    );
    const responseBody = buildManualAttendanceRequestResource(
      world,
      employeeId,
      createdRequest.id,
    );

    logger.info(
      {
        event: "attendance.manual.create.succeeded",
        requestId: createdRequest.id,
        rootRequestId: createdRequest.rootRequestId,
      },
      "Created manual attendance request",
    );

    return Response.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof ManualAttendanceValidationError) {
      logger.warn(
        {
          event: "attendance.manual.create.validation_failed",
          message: error.message,
        },
        "Rejected manual attendance create request",
      );
      return validationErrorResponse(error.message);
    }

    if (error instanceof ManualAttendanceNotFoundError) {
      logger.warn(
        {
          event: "attendance.manual.create.not_found",
          message: error.message,
        },
        "Manual attendance parent request was not found",
      );
      return notFoundErrorResponse(error.message);
    }

    if (error instanceof ManualAttendanceConflictError) {
      logger.warn(
        {
          event: "attendance.manual.create.conflict",
          message: error.message,
        },
        "Manual attendance create conflicted with the current request chain",
      );
      return conflictErrorResponse(error.message);
    }

    throw error;
  }
}
