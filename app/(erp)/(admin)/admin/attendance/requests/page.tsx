import { AdminRequestsWorkspace } from "@/app/(erp)/(admin)/admin/attendance/requests/_components/admin-requests-workspace";
import { getAdminRequests } from "@/lib/api/admin-requests";

import { getRequestOrigin } from "../_lib/request-origin";
import { normalizeAdminRequestsUrlState } from "./_lib/page-state";

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const normalized = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      normalized.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        normalized.append(key, item);
      }
    }
  }

  return normalized;
}

export default async function AdminRequestManagementPage(
  props: PageProps<"/admin/attendance/requests">,
) {
  const rawSearchParams = await props.searchParams;
  const state = normalizeAdminRequestsUrlState(
    toUrlSearchParams(rawSearchParams),
  );
  const baseUrl = await getRequestOrigin();
  const initialData = await getAdminRequests(
    {
      view: state.view,
    },
    { baseUrl },
  );

  return (
    <AdminRequestsWorkspace
      initialData={initialData}
      initialView={state.view}
    />
  );
}
