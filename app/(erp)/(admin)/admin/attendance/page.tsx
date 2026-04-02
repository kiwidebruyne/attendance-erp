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
    <div className="flex flex-1 flex-col gap-8">
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          팀 근태 운영
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-secondary">
          오늘 바로 확인할 운영 이슈를 먼저 보고, 필요한 이력은 같은 화면에서
          이어서 비교해요
        </p>
      </header>

      <AdminAttendanceWorkspace
        historyResponse={historyResponse}
        state={state}
        todayResponse={todayResponse}
      />
    </div>
  );
}
