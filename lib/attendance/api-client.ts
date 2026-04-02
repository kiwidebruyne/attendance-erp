import {
  type AttendanceHistoryQuery,
  attendanceHistoryQuerySchema,
  type AttendanceHistoryResponse,
  attendanceHistoryResponseSchema,
  type AttendanceTodayResponse,
  attendanceTodayResponseSchema,
  type ManualAttendanceRequestBody,
  manualAttendanceRequestBodySchema,
  type ManualAttendanceRequestPatchBody,
  manualAttendanceRequestPatchBodySchema,
  type ManualAttendanceRequestResponse,
  manualAttendanceRequestResponseSchema,
} from "@/lib/contracts/attendance";
import { errorResponseSchema } from "@/lib/contracts/shared";

export class AttendanceApiError extends Error {
  code: string;
  status: number;

  constructor(input: { code: string; message: string; status: number }) {
    super(input.message);
    this.name = "AttendanceApiError";
    this.code = input.code;
    this.status = input.status;
  }
}

async function parseJsonResponse<TData>(
  response: Response,
  parse: (value: unknown) => TData,
) {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(body);

    throw new AttendanceApiError({
      code: parsedError.success ? parsedError.data.error.code : "unknown_error",
      message: parsedError.success
        ? parsedError.data.error.message
        : "Attendance API request failed",
      status: response.status,
    });
  }

  return parse(body);
}

export async function getAttendanceToday(): Promise<AttendanceTodayResponse> {
  const response = await fetch("/api/attendance/me", {
    cache: "no-store",
  });

  return parseJsonResponse(response, attendanceTodayResponseSchema.parse);
}

export async function getAttendanceHistory(
  input: AttendanceHistoryQuery,
): Promise<AttendanceHistoryResponse> {
  const query = attendanceHistoryQuerySchema.parse(input);
  const searchParams = new URLSearchParams(query);
  const response = await fetch(`/api/attendance/me/history?${searchParams}`, {
    cache: "no-store",
  });

  return parseJsonResponse(response, attendanceHistoryResponseSchema.parse);
}

export async function createManualAttendanceRequest(
  input: ManualAttendanceRequestBody,
): Promise<ManualAttendanceRequestResponse> {
  const body = manualAttendanceRequestBodySchema.parse(input);
  const response = await fetch("/api/attendance/manual", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(
    response,
    manualAttendanceRequestResponseSchema.parse,
  );
}

export async function updateManualAttendanceRequest(
  requestId: string,
  input: ManualAttendanceRequestPatchBody,
): Promise<ManualAttendanceRequestResponse> {
  const body = manualAttendanceRequestPatchBodySchema.parse(input);
  const response = await fetch(`/api/attendance/manual/${requestId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(
    response,
    manualAttendanceRequestResponseSchema.parse,
  );
}
