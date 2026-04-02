"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AdminAttendanceListResponse,
  AdminAttendanceTodayResponse,
} from "@/lib/contracts/admin-attendance";

import {
  type AdminAttendanceHistoryUrlState,
  type AdminAttendanceUrlState,
  normalizeAdminAttendanceUrlState,
} from "../_lib/page-state";
import type { AdminAttendanceTodayExceptionRow } from "../_lib/today-exception-rows";
import { AdminAttendanceHistoryView } from "./admin-attendance-history-view";
import { AdminAttendanceTodayView } from "./admin-attendance-today-view";

type AdminAttendanceWorkspaceProps = {
  historyResponse?: AdminAttendanceListResponse;
  state: AdminAttendanceUrlState;
  todayExceptionRows?: AdminAttendanceTodayExceptionRow[];
  todayResponse?: AdminAttendanceTodayResponse;
};

const defaultHistoryState = normalizeAdminAttendanceUrlState(
  new URLSearchParams("mode=history"),
) as AdminAttendanceHistoryUrlState;
const adminAttendanceRoute = "/admin/attendance" satisfies Route;

function buildSearchParams(state: AdminAttendanceUrlState) {
  const searchParams = new URLSearchParams();

  if (state.mode === "history") {
    searchParams.set("mode", "history");
    searchParams.set("from", state.from);
    searchParams.set("to", state.to);
  }

  if (state.name !== undefined) {
    searchParams.set("name", state.name);
  }

  return searchParams;
}

function withOptionalName(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function getNextModeFromKey(
  currentMode: AdminAttendanceUrlState["mode"],
  key: string,
) {
  if (currentMode === "today" && (key === "ArrowRight" || key === "End")) {
    return "history";
  }

  if (currentMode === "history" && (key === "ArrowLeft" || key === "Home")) {
    return "today";
  }

  return null;
}

export function AdminAttendanceWorkspace({
  historyResponse,
  state,
  todayExceptionRows,
  todayResponse,
}: AdminAttendanceWorkspaceProps) {
  const router = useRouter();

  function replaceState(nextState: AdminAttendanceUrlState) {
    const nextSearchParams = buildSearchParams(nextState).toString();
    const nextRoute =
      nextSearchParams.length === 0
        ? adminAttendanceRoute
        : (`${adminAttendanceRoute}?${nextSearchParams}` as Route);

    router.replace(nextRoute);
  }

  function handleModeChange(mode: string) {
    if (mode === state.mode) {
      return;
    }

    if (mode === "history") {
      replaceState({
        ...defaultHistoryState,
        ...(state.name === undefined ? {} : { name: state.name }),
      });
      return;
    }

    replaceState({
      mode: "today",
      ...(state.name === undefined ? {} : { name: state.name }),
    });
  }

  function handleTriggerKeyDown(key: string) {
    const nextMode = getNextModeFromKey(state.mode, key);

    if (nextMode !== null) {
      handleModeChange(nextMode);
    }
  }

  return (
    <Tabs className="gap-6" value={state.mode}>
      <TabsList className="rounded-[12px] bg-muted p-1">
        <TabsTrigger
          className="min-w-[88px]"
          onClick={() => handleModeChange("today")}
          onKeyDown={(event) => handleTriggerKeyDown(event.key)}
          value="today"
        >
          오늘
        </TabsTrigger>
        <TabsTrigger
          className="min-w-[88px]"
          onClick={() => handleModeChange("history")}
          onKeyDown={(event) => handleTriggerKeyDown(event.key)}
          value="history"
        >
          이력
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-0" value="today">
        {todayResponse === undefined ||
        todayExceptionRows === undefined ? null : (
          <AdminAttendanceTodayView
            exceptionRows={todayExceptionRows}
            name={state.name}
            onNameChange={(name) =>
              replaceState({
                mode: "today",
                ...(withOptionalName(name) === undefined
                  ? { name: undefined }
                  : { name: withOptionalName(name) }),
              })
            }
            response={todayResponse}
          />
        )}
      </TabsContent>

      <TabsContent className="mt-0" value="history">
        {state.mode === "history" && historyResponse !== undefined ? (
          <AdminAttendanceHistoryView
            from={state.from}
            name={state.name}
            onFromChange={(from) =>
              replaceState({
                ...state,
                from,
              })
            }
            onNameChange={(name) =>
              replaceState({
                ...state,
                ...(withOptionalName(name) === undefined
                  ? { name: undefined }
                  : { name: withOptionalName(name) }),
              })
            }
            onToChange={(to) =>
              replaceState({
                ...state,
                to,
              })
            }
            response={historyResponse}
            to={state.to}
          />
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
