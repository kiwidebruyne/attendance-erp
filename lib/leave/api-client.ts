import {
  type LeaveOverviewQuery,
  leaveOverviewQuerySchema,
  type LeaveOverviewResponse,
  leaveOverviewResponseSchema,
  type LeaveRequestBody,
  leaveRequestBodySchema,
  type LeaveRequestPatchBody,
  leaveRequestPatchBodySchema,
  type LeaveRequestResponse,
  leaveRequestResponseSchema,
} from "@/lib/contracts/leave";
import { errorResponseSchema } from "@/lib/contracts/shared";

export class LeaveApiError extends Error {
  code: string;
  status: number;

  constructor(input: { code: string; message: string; status: number }) {
    super(input.message);
    this.name = "LeaveApiError";
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

    throw new LeaveApiError({
      code: parsedError.success ? parsedError.data.error.code : "unknown_error",
      message: parsedError.success
        ? parsedError.data.error.message
        : "Leave API request failed",
      status: response.status,
    });
  }

  return parse(body);
}

export async function getLeaveOverview(
  input: LeaveOverviewQuery = {},
): Promise<LeaveOverviewResponse> {
  const query = leaveOverviewQuerySchema.parse(input);
  const searchParams = new URLSearchParams();

  if (query.date !== undefined) {
    searchParams.set("date", query.date);
  }

  const queryString = searchParams.toString();
  const response = await fetch(
    queryString.length > 0 ? `/api/leave/me?${queryString}` : "/api/leave/me",
    {
      cache: "no-store",
    },
  );

  return parseJsonResponse(response, leaveOverviewResponseSchema.parse);
}

export async function createLeaveRequest(
  input: LeaveRequestBody,
): Promise<LeaveRequestResponse> {
  const body = leaveRequestBodySchema.parse(input);
  const response = await fetch("/api/leave/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response, leaveRequestResponseSchema.parse);
}

export async function updateLeaveRequest(
  requestId: string,
  input: LeaveRequestPatchBody,
): Promise<LeaveRequestResponse> {
  const body = leaveRequestPatchBodySchema.parse(input);
  const response = await fetch(`/api/leave/request/${requestId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response, leaveRequestResponseSchema.parse);
}
