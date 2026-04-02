import { AdminAttendanceWorkspace } from "./_components/admin-attendance-workspace";
import { loadAdminAttendanceScreenData } from "./_lib/load-admin-attendance-screen-data";
import { normalizeAdminAttendanceUrlState } from "./_lib/page-state";
import { getRequestOrigin } from "./_lib/request-origin";

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

export default async function AdminAttendancePage(
  props: PageProps<"/admin/attendance">,
) {
  const rawSearchParams = await props.searchParams;
  const state = normalizeAdminAttendanceUrlState(
    toUrlSearchParams(rawSearchParams),
  );
  const baseUrl = await getRequestOrigin();
  const { historyResponse, todayResponse } =
    await loadAdminAttendanceScreenData({
      baseUrl,
      state,
    });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-secondary uppercase">
          Admin
        </p>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            팀 근태 대시보드
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            오늘 운영 상태와 최근 이력을 같은 화면에서 바로 비교해요.
          </p>
        </div>
      </header>

      <AdminAttendanceWorkspace
        historyResponse={historyResponse}
        state={state}
        todayResponse={todayResponse}
      />
    </div>
  );
}
