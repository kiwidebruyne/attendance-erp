import {
  type AdminAttendanceListResponse,
  adminAttendanceListResponseSchema,
  type AdminAttendanceTodayResponse,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";

type AdminAttendanceApiOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

function buildUrl(pathname: string, baseUrl?: string) {
  if (baseUrl === undefined) {
    return pathname;
  }

  return new URL(pathname, baseUrl).toString();
}

async function parseResponse<T>(
  response: Response,
  parser: { parse: (value: unknown) => T },
  failureMessage: string,
) {
  if (!response.ok) {
    throw new Error(failureMessage);
  }

  return parser.parse(await response.json());
}

export async function fetchAdminAttendanceToday(
  options: AdminAttendanceApiOptions = {},
): Promise<AdminAttendanceTodayResponse> {
  const response = await (options.fetch ?? fetch)(
    buildUrl("/api/admin/attendance/today", options.baseUrl),
    {
      cache: "no-store",
    },
  );

  return parseResponse(
    response,
    adminAttendanceTodayResponseSchema,
    "Failed to fetch admin attendance today.",
  );
}

export async function fetchAdminAttendanceList(
  input: {
    from: string;
    to: string;
    name?: string;
  },
  options: AdminAttendanceApiOptions = {},
): Promise<AdminAttendanceListResponse> {
  const searchParams = new URLSearchParams({
    from: input.from,
    to: input.to,
  });

  if (input.name !== undefined) {
    searchParams.set("name", input.name);
  }

  const response = await (options.fetch ?? fetch)(
    buildUrl(
      `/api/admin/attendance/list?${searchParams.toString()}`,
      options.baseUrl,
    ),
    {
      cache: "no-store",
    },
  );

  return parseResponse(
    response,
    adminAttendanceListResponseSchema,
    "Failed to fetch admin attendance history.",
  );
}
