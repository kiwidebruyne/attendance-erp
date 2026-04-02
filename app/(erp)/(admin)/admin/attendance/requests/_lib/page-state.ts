import {
  type RequestQueueView,
  requestQueueViewSchema,
} from "@/lib/contracts/shared";

export type AdminRequestsUrlState = {
  view: RequestQueueView;
};

function trimToUndefined(value: string | null) {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeView(value: string | undefined): RequestQueueView {
  const parsed = requestQueueViewSchema.safeParse(value);

  return parsed.success ? parsed.data : "needs_review";
}

export function normalizeAdminRequestsUrlState(
  searchParams: URLSearchParams,
): AdminRequestsUrlState {
  return {
    view: normalizeView(trimToUndefined(searchParams.get("view"))),
  };
}

export function buildAdminRequestsSearchParams(view: RequestQueueView) {
  const searchParams = new URLSearchParams();

  if (view !== "needs_review") {
    searchParams.set("view", view);
  }

  return searchParams;
}
