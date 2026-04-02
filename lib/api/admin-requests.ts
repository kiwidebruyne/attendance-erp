import {
  type AdminRequestDecisionBody,
  adminRequestDecisionBodySchema,
  type AdminRequestDecisionResponse,
  adminRequestDecisionResponseSchema,
  type AdminRequestsResponse,
  adminRequestsResponseSchema,
} from "@/lib/contracts/requests";
import {
  errorResponseSchema,
  type RequestQueueView,
} from "@/lib/contracts/shared";

type AdminRequestsApiOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class AdminRequestsApiError extends Error {
  code: string;
  status: number;
  activeRequestId?: string;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    activeRequestId?: string;
  }) {
    super(input.message);
    this.name = "AdminRequestsApiError";
    this.code = input.code;
    this.status = input.status;
    this.activeRequestId = input.activeRequestId;
  }
}

function buildUrl(pathname: string, baseUrl?: string) {
  if (baseUrl === undefined) {
    return pathname;
  }

  return new URL(pathname, baseUrl).toString();
}

async function parseJsonResponse<TData>(
  response: Response,
  parse: (value: unknown) => TData,
) {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(body);

    throw new AdminRequestsApiError({
      code: parsedError.success ? parsedError.data.error.code : "unknown_error",
      message: parsedError.success
        ? parsedError.data.error.message
        : "Admin requests API request failed",
      status: response.status,
      ...(parsedError.success &&
      parsedError.data.error.activeRequestId !== undefined
        ? { activeRequestId: parsedError.data.error.activeRequestId }
        : {}),
    });
  }

  return parse(body);
}

export async function getAdminRequests(
  input: { view?: RequestQueueView } = {},
  options: AdminRequestsApiOptions = {},
): Promise<AdminRequestsResponse> {
  const searchParams = new URLSearchParams();

  if (input.view !== undefined) {
    searchParams.set("view", input.view);
  }

  const pathname =
    searchParams.toString().length === 0
      ? "/api/admin/requests"
      : `/api/admin/requests?${searchParams.toString()}`;
  const response = await (options.fetch ?? fetch)(
    buildUrl(pathname, options.baseUrl),
    {
      cache: "no-store",
    },
  );

  return parseJsonResponse(response, adminRequestsResponseSchema.parse);
}

export async function patchAdminRequest(
  requestId: string,
  input: AdminRequestDecisionBody,
  options: AdminRequestsApiOptions = {},
): Promise<AdminRequestDecisionResponse> {
  const parsedInput = adminRequestDecisionBodySchema.parse(input);
  const response = await (options.fetch ?? fetch)(
    buildUrl(`/api/admin/requests/${requestId}`, options.baseUrl),
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput),
    },
  );

  return parseJsonResponse(response, adminRequestDecisionResponseSchema.parse);
}
