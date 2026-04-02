import {
  fetchAdminAttendanceList,
  fetchAdminAttendanceToday,
} from "@/lib/api/admin-attendance";

import type { AdminAttendanceUrlState } from "./page-state";
import { buildAdminAttendanceTodayExceptionRows } from "./today-exception-rows";

type LoadAdminAttendanceScreenDataInput = {
  baseUrl: string;
  state: AdminAttendanceUrlState;
};

export async function loadAdminAttendanceScreenData({
  baseUrl,
  state,
}: LoadAdminAttendanceScreenDataInput) {
  if (state.mode === "history") {
    return {
      historyResponse: await fetchAdminAttendanceList(
        {
          from: state.from,
          to: state.to,
          ...(state.name === undefined ? {} : { name: state.name }),
        },
        { baseUrl },
      ),
      todayExceptionRows: undefined,
      todayResponse: undefined,
    };
  }

  const todayResponse = await fetchAdminAttendanceToday({ baseUrl });

  return {
    historyResponse: undefined,
    todayExceptionRows: buildAdminAttendanceTodayExceptionRows(todayResponse),
    todayResponse,
  };
}
