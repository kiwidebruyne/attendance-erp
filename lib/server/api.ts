import { z, ZodError, type ZodType } from "zod";

type ParseSuccess<TData> = {
  success: true;
  data: TData;
};

type ParseFailure = {
  success: false;
  response: Response;
};

export type ParseResult<TData> = ParseSuccess<TData> | ParseFailure;

export function validationErrorResponse(message: string): Response {
  return errorResponse("validation_error", message, 400);
}

export function conflictErrorResponse(message: string): Response {
  return errorResponse("conflict", message, 409);
}

export function conflictErrorResponseWithActiveRequestId(
  message: string,
  activeRequestId: string,
): Response {
  return errorResponse("conflict", message, 409, {
    activeRequestId,
  });
}

export function notFoundErrorResponse(message: string): Response {
  return errorResponse("not_found", message, 404);
}

function errorResponse(
  code: "validation_error" | "conflict" | "not_found",
  message: string,
  status: number,
  additionalErrorFields: Record<string, string> = {},
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        ...additionalErrorFields,
      },
    },
    {
      status,
    },
  );
}

function formatIssuePath(issue: z.core.$ZodIssue): string | null {
  if (issue.path.length === 0) {
    return null;
  }

  return issue.path.join(".");
}

function formatValidationErrorMessage(
  error: ZodError,
  scope: "query" | "body",
): string {
  const firstIssue = error.issues[0];
  const path = formatIssuePath(firstIssue);

  if (scope === "query") {
    return path
      ? `Invalid query parameter "${path}": ${firstIssue.message}`
      : `Invalid query parameters: ${firstIssue.message}`;
  }

  return path
    ? `Invalid request body for "${path}": ${firstIssue.message}`
    : `Invalid request body: ${firstIssue.message}`;
}

export function parseSearchParams<TData>(
  schema: ZodType<TData>,
  searchParams: URLSearchParams,
): ParseResult<TData> {
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return {
      success: false,
      response: validationErrorResponse(
        formatValidationErrorMessage(parsed.error, "query"),
      ),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}

export async function parseJsonBody<TData>(
  schema: ZodType<TData>,
  request: Request,
): Promise<ParseResult<TData>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: validationErrorResponse(
        "Invalid request body: Request body must be valid JSON",
      ),
    };
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      success: false,
      response: validationErrorResponse(
        formatValidationErrorMessage(parsed.error, "body"),
      ),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}
