import {
  fetchAdminAttendanceList,
  fetchAdminAttendanceToday,
} from "@/lib/api/admin-attendance";

import type { AdminAttendanceUrlState } from "./page-state";

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
      todayResponse: undefined,
    };
  }

  return {
    historyResponse: undefined,
    todayResponse: await fetchAdminAttendanceToday({ baseUrl }),
  };
}
