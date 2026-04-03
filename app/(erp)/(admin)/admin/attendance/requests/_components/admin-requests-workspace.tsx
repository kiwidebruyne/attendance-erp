"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import {
  AdminRequestsApiError,
  getAdminRequests,
  patchAdminRequest,
} from "@/lib/api/admin-requests";
import type {
  AdminRequestDecisionBody,
  AdminRequestsResponse,
} from "@/lib/contracts/requests";
import type { RequestQueueView, RequestStatus } from "@/lib/contracts/shared";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

import {
  type AdminRequestItem,
  type AdminRequestsView,
  buildLeaveConflictLines,
  formatDateLabel,
  formatDateShortLabel,
  formatDateTimeLabel,
  formatFollowUpKindLabel,
  formatLeaveOperationalWarningLabel,
  formatRequestSubtypeLabel,
  formatRequestTimestamp,
  formatRequestTypeLabel,
  formatStatusLabel,
  isLeaveRequestItem,
  isManualRequestItem,
  type LeaveAdminRequestItem,
  type ManualAdminRequestItem,
} from "../_lib/formatting";
import { buildAdminRequestsSearchParams } from "../_lib/page-state";
import type { AdminRequestDetailPanelProps } from "./admin-request-detail-panel";
import type { AdminRequestReviewTableColumn } from "./admin-request-review-table-section";
import { AdminRequestsScreen } from "./admin-requests-screen";

const adminRequestsRoute = "/admin/attendance/requests" satisfies Route;

type ManualFilters = Readonly<{
  department: string;
  name: string;
  reason: string;
  status: string;
  subtype: string;
  targetDate: DateRangeFilter;
}>;

type LeaveFilters = Readonly<{
  department: string;
  name: string;
  reason: string;
  status: string;
  subtype: string;
  targetDate: DateRangeFilter;
  time: string;
  warning: string;
}>;

type DateRangePreset = "" | "last_30_days" | "last_7_days" | "today";

type DateRangeFilter = Readonly<{
  from: string;
  preset: DateRangePreset;
  to: string;
}>;

type DetailPanelInput = Readonly<{
  errorMessage: string | null;
  isPending: boolean;
  isWarningConfirmationActive: boolean;
  onApprove: () => void;
  onCancelWarningConfirmation: () => void;
  onReject: () => void;
  onRequestCommentChange: (value: string) => void;
  onRequestRevision: () => void;
  onStartWarningConfirmation: () => void;
  reviewComment: string;
  reviewCommentInputId: string;
}>;

type ScopedBooleanState = Readonly<{
  isActive: boolean;
  selectionKey: string;
}>;

type ScopedErrorState = Readonly<{
  message: string | null;
  selectionKey: string;
}>;

type ScopedTextState = Readonly<{
  selectionKey: string;
  value: string;
}>;

const defaultManualFilters: ManualFilters = {
  department: "",
  name: "",
  reason: "",
  status: "",
  subtype: "",
  targetDate: {
    from: "",
    preset: "",
    to: "",
  },
};

const defaultLeaveFilters: LeaveFilters = {
  department: "",
  name: "",
  reason: "",
  status: "",
  subtype: "",
  targetDate: {
    from: "",
    preset: "",
    to: "",
  },
  time: "",
  warning: "",
};

const manualSubtypeOptions = [
  { label: "전체", value: "" },
  { label: "출근 정정", value: "clock_in" },
  { label: "퇴근 정정", value: "clock_out" },
  { label: "출근·퇴근 정정", value: "both" },
] as const;

const leaveSubtypeOptions = [
  { label: "전체", value: "" },
  { label: "연차", value: "annual" },
  { label: "반차(오전)", value: "half_am" },
  { label: "반차(오후)", value: "half_pm" },
  { label: "시간차", value: "hourly" },
] as const;

const requestStatusOptions = [
  { label: "전체", value: "" },
  { label: "검토 필요", value: "pending" },
  { label: "승인 완료", value: "approved" },
  { label: "철회 완료", value: "withdrawn" },
  { label: "보완 요청", value: "revision_requested" },
  { label: "반려", value: "rejected" },
] as const;

const leaveWarningOptions = [
  { label: "전체", value: "" },
  { label: "경고 있음", value: "warning" },
  { label: "경고 없음", value: "none" },
] as const;

const dateRangePresetOptions = [
  { label: "오늘", value: "today" },
  { label: "최근 7일", value: "last_7_days" },
  { label: "최근 30일", value: "last_30_days" },
] as const;

function buildRoute(view: RequestQueueView) {
  const searchParams = buildAdminRequestsSearchParams(view).toString();

  return searchParams.length === 0
    ? adminRequestsRoute
    : (`${adminRequestsRoute}?${searchParams}` as Route);
}

function getErrorMessage(error: unknown) {
  if (error instanceof AdminRequestsApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "요청 상태를 처리하지 못했어요";
}

function getSubmittedTimestamp(item: AdminRequestItem) {
  return item.requestType === "manual_attendance"
    ? item.submittedAt
    : item.requestedAt;
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase();
}

const seoulDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Seoul",
  year: "numeric",
});

function formatSeoulDate(date: Date) {
  return seoulDateFormatter.format(date);
}

function shiftSeoulDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatSeoulDate(date);
}

function getTodaySeoulDate() {
  return formatSeoulDate(new Date());
}

function buildDateRangeForPreset(preset: DateRangePreset): DateRangeFilter {
  if (preset === "") {
    return {
      from: "",
      preset: "",
      to: "",
    };
  }

  const today = getTodaySeoulDate();

  if (preset === "today") {
    return {
      from: today,
      preset,
      to: today,
    };
  }

  return {
    from: shiftSeoulDate(today, preset === "last_7_days" ? -6 : -29),
    preset,
    to: today,
  };
}

function matchesContains(value: string, query: string) {
  if (query.trim().length === 0) {
    return true;
  }

  return normalizeText(value).includes(normalizeText(query));
}

function matchesExact(value: string, filterValue: string) {
  return filterValue === "" || value === filterValue;
}

function matchesDateRange(value: string, range: DateRangeFilter) {
  if (range.from.length > 0 && value < range.from) {
    return false;
  }

  if (range.to.length > 0 && value > range.to) {
    return false;
  }

  return true;
}

function getNextActionableSelection<TItem extends AdminRequestItem>(
  items: TItem[],
  currentRequestId: string,
) {
  const currentIndex = items.findIndex((item) => item.id === currentRequestId);

  if (currentIndex === -1) {
    return null;
  }

  const nextActionable =
    items.slice(currentIndex + 1).find((item) => item.status === "pending") ??
    items.slice(0, currentIndex).find((item) => item.status === "pending") ??
    null;

  return nextActionable?.id ?? null;
}

function matchesManualFilters(
  item: ManualAdminRequestItem,
  filters: ManualFilters,
) {
  return (
    matchesContains(item.employee.name, filters.name) &&
    matchesContains(item.employee.department, filters.department) &&
    matchesExact(item.subtype, filters.subtype) &&
    matchesDateRange(item.targetDate, filters.targetDate) &&
    matchesExact(item.status, filters.status) &&
    matchesContains(item.reason, filters.reason)
  );
}

function matchesLeaveFilters(
  item: LeaveAdminRequestItem,
  filters: LeaveFilters,
) {
  const warningValue = formatLeaveOperationalWarningLabel(item);

  return (
    matchesContains(item.employee.name, filters.name) &&
    matchesContains(item.employee.department, filters.department) &&
    matchesExact(item.subtype, filters.subtype) &&
    matchesContains(getLeaveTimeLabel(item), filters.time) &&
    matchesDateRange(item.targetDate, filters.targetDate) &&
    matchesExact(item.status, filters.status) &&
    matchesContains(item.reason, filters.reason) &&
    (filters.warning === "" ||
      (filters.warning === "warning" && warningValue === "경고 있음") ||
      (filters.warning === "none" && warningValue === "경고 없음"))
  );
}

function getStatusTone(status: RequestStatus) {
  switch (status) {
    case "approved":
      return "bg-status-success-soft text-status-success";
    case "withdrawn":
      return "bg-muted text-secondary";
    case "revision_requested":
      return "bg-status-warning-soft text-status-warning";
    case "rejected":
      return "bg-status-danger-soft text-status-danger";
    case "pending":
    default:
      return "bg-status-info-soft text-status-info";
  }
}

function StatusBadge({ status }: Readonly<{ status: RequestStatus }>) {
  return (
    <Badge
      className={cn("border-transparent", getStatusTone(status))}
      variant="outline"
    >
      {formatStatusLabel(status)}
    </Badge>
  );
}

function WarningBadge({
  item,
}: Readonly<{
  item: LeaveAdminRequestItem;
}>) {
  const label = formatLeaveOperationalWarningLabel(item);

  return (
    <Badge
      className={cn(
        "border-transparent",
        label === "경고 있음"
          ? "bg-status-warning-soft text-status-warning"
          : "bg-muted text-secondary",
      )}
      variant="outline"
    >
      {label}
    </Badge>
  );
}

function getLeaveTimeLabel(item: LeaveAdminRequestItem) {
  if (item.subtype !== "hourly") {
    return "-";
  }

  return `${formatDateTimeLabel(item.startAt)}-${formatDateTimeLabel(
    item.endAt,
  )}`;
}

function buildFactRows(item: AdminRequestItem) {
  const facts = [
    {
      detail: formatDateLabel(item.targetDate),
      label: "대상일",
    },
    {
      detail: formatRequestSubtypeLabel(item),
      label:
        item.requestType === "manual_attendance" ? "정정 종류" : "휴가 종류",
    },
  ] as AdminRequestDetailPanelProps["facts"];

  if (item.followUpKind !== null) {
    facts.push({
      detail: formatFollowUpKindLabel(item) ?? "-",
      label: "후속 요청",
      tone: "subtle",
    });
  }

  if (isLeaveRequestItem(item)) {
    if (item.subtype === "hourly") {
      facts.push({
        detail: getLeaveTimeLabel(item),
        label: "시간",
      });
    }

    if (formatLeaveOperationalWarningLabel(item) === "경고 있음") {
      facts.push({
        detail: "경고 있음",
        label: "운영 경고",
        tone: "warning",
      });
    }

    const conflictLines = buildLeaveConflictLines(item);

    if (conflictLines.length > 0) {
      facts.push({
        detail: conflictLines.join(" "),
        label: "운영 맥락",
        tone: "warning",
      });
    }
  }

  facts.push({
    detail: item.reason,
    label: "사유",
    tone: "subtle",
  });

  if (item.governingReviewComment !== null) {
    facts.push({
      detail: item.governingReviewComment,
      label: item.status === "pending" ? "남은 검토 사유" : "검토 사유",
      tone: item.status === "pending" ? "warning" : "history",
    });
  }

  return facts;
}

function buildWarningConfirmation(item: AdminRequestItem) {
  if (
    !isLeaveRequestItem(item) ||
    item.leaveConflict?.requiresApprovalConfirmation !== true
  ) {
    return null;
  }

  return {
    lines: buildLeaveConflictLines(item),
    summary: "운영 영향이 남아 있는 상태라 한 번 더 확인한 뒤 승인해야 해요",
  };
}

function buildDetailPanelProps(
  item: AdminRequestItem,
  input: DetailPanelInput,
): AdminRequestDetailPanelProps {
  return {
    currentStatusLabel: formatStatusLabel(item.status),
    employeeDepartmentLabel: item.employee.department,
    employeeName: item.employee.name,
    errorMessage: input.errorMessage,
    facts: buildFactRows(item),
    isPending: input.isPending,
    isWarningConfirmationActive: input.isWarningConfirmationActive,
    mode: item.status === "pending" ? "actionable" : "completed_history",
    requestTypeLabel: `${formatRequestTypeLabel(item)} · ${formatRequestSubtypeLabel(item)}`,
    reviewedAtLabel:
      item.reviewedAt === null
        ? null
        : `검토 ${formatRequestTimestamp(item.reviewedAt)}`,
    reviewComment: input.reviewComment,
    reviewCommentInputId: input.reviewCommentInputId,
    showReviewCommentInput: item.status === "pending",
    submittedAtLabel: `제출 ${formatRequestTimestamp(getSubmittedTimestamp(item))}`,
    warningConfirmation: buildWarningConfirmation(item),
    ...(item.status === "pending"
      ? {
          onApprove: input.onApprove,
          onCancelWarningConfirmation: input.onCancelWarningConfirmation,
          onReject: input.onReject,
          onRequestCommentChange: input.onRequestCommentChange,
          onRequestRevision: input.onRequestRevision,
          onStartWarningConfirmation: input.onStartWarningConfirmation,
        }
      : {}),
  };
}

function resetManualFilters() {
  return defaultManualFilters;
}

function resetLeaveFilters() {
  return defaultLeaveFilters;
}

export function AdminRequestsWorkspace({
  initialData,
  initialView,
}: Readonly<{
  initialData: AdminRequestsResponse;
  initialView: RequestQueueView;
}>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRouting, startRoutingTransition] = useTransition();

  const [manualPreferredRequestId, setManualPreferredRequestId] = useState<
    string | null
  >(null);
  const [leavePreferredRequestId, setLeavePreferredRequestId] = useState<
    string | null
  >(null);

  const [manualFilters, setManualFilters] =
    useState<ManualFilters>(resetManualFilters);
  const [leaveFilters, setLeaveFilters] =
    useState<LeaveFilters>(resetLeaveFilters);

  const [manualReviewDraft, setManualReviewDraft] = useState<ScopedTextState>({
    selectionKey: "",
    value: "",
  });
  const [leaveReviewDraft, setLeaveReviewDraft] = useState<ScopedTextState>({
    selectionKey: "",
    value: "",
  });
  const [manualErrorState, setManualErrorState] = useState<ScopedErrorState>({
    message: null,
    selectionKey: "",
  });
  const [leaveErrorState, setLeaveErrorState] = useState<ScopedErrorState>({
    message: null,
    selectionKey: "",
  });
  const [leaveWarningState, setLeaveWarningState] =
    useState<ScopedBooleanState>({
      isActive: false,
      selectionKey: "",
    });

  const requestsQuery = useQuery({
    initialData,
    queryFn: () => getAdminRequests({ view: initialView }),
    queryKey: queryKeys.adminRequests.byView(initialView),
  });

  const items = requestsQuery.data?.items ?? initialData.items;
  const manualItems = useMemo(() => items.filter(isManualRequestItem), [items]);
  const leaveItems = useMemo(() => items.filter(isLeaveRequestItem), [items]);

  const filteredManualItems = useMemo(
    () =>
      manualItems.filter((item) => matchesManualFilters(item, manualFilters)),
    [manualFilters, manualItems],
  );
  const filteredLeaveItems = useMemo(
    () => leaveItems.filter((item) => matchesLeaveFilters(item, leaveFilters)),
    [leaveFilters, leaveItems],
  );

  const manualSelectedRequestId = useMemo(() => {
    if (filteredManualItems.length === 0) {
      return null;
    }

    if (
      manualPreferredRequestId !== null &&
      filteredManualItems.some((item) => item.id === manualPreferredRequestId)
    ) {
      return manualPreferredRequestId;
    }

    return filteredManualItems[0]?.id ?? null;
  }, [filteredManualItems, manualPreferredRequestId]);

  const leaveSelectedRequestId = useMemo(() => {
    if (filteredLeaveItems.length === 0) {
      return null;
    }

    if (
      leavePreferredRequestId !== null &&
      filteredLeaveItems.some((item) => item.id === leavePreferredRequestId)
    ) {
      return leavePreferredRequestId;
    }

    return filteredLeaveItems[0]?.id ?? null;
  }, [filteredLeaveItems, leavePreferredRequestId]);

  const manualSelectionKey = `${initialView}:${manualSelectedRequestId ?? ""}`;
  const leaveSelectionKey = `${initialView}:${leaveSelectedRequestId ?? ""}`;
  const manualReviewComment =
    manualReviewDraft.selectionKey === manualSelectionKey
      ? manualReviewDraft.value
      : "";
  const leaveReviewComment =
    leaveReviewDraft.selectionKey === leaveSelectionKey
      ? leaveReviewDraft.value
      : "";
  const manualMutationError =
    manualErrorState.selectionKey === manualSelectionKey
      ? manualErrorState.message
      : null;
  const leaveMutationError =
    leaveErrorState.selectionKey === leaveSelectionKey
      ? leaveErrorState.message
      : null;
  const isLeaveWarningConfirmationActive =
    leaveWarningState.selectionKey === leaveSelectionKey
      ? leaveWarningState.isActive
      : false;

  const manualSelectedItem =
    filteredManualItems.find((item) => item.id === manualSelectedRequestId) ??
    null;
  const leaveSelectedItem =
    filteredLeaveItems.find((item) => item.id === leaveSelectedRequestId) ??
    null;

  const manualMutation = useMutation({
    mutationFn: ({
      decision,
      requestId,
    }: {
      decision: AdminRequestDecisionBody;
      nextSelectionId: string | null;
      requestId: string;
    }) => patchAdminRequest(requestId, decision),
    onError: (error, variables) => {
      setManualErrorState({
        message: getErrorMessage(error),
        selectionKey: `${initialView}:${variables.requestId}`,
      });
    },
    onSuccess: async (_response, variables) => {
      setManualErrorState({ message: null, selectionKey: "" });
      setManualReviewDraft({ selectionKey: "", value: "" });

      if (variables.nextSelectionId !== null) {
        setManualPreferredRequestId(variables.nextSelectionId);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminRequests.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminAttendance.all,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leave.all }),
      ]);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: ({
      decision,
      requestId,
    }: {
      decision: AdminRequestDecisionBody;
      nextSelectionId: string | null;
      requestId: string;
    }) => patchAdminRequest(requestId, decision),
    onError: (error, variables) => {
      setLeaveErrorState({
        message: getErrorMessage(error),
        selectionKey: `${initialView}:${variables.requestId}`,
      });
    },
    onSuccess: async (_response, variables) => {
      setLeaveErrorState({ message: null, selectionKey: "" });
      setLeaveReviewDraft({ selectionKey: "", value: "" });
      setLeaveWarningState({ isActive: false, selectionKey: "" });

      if (variables.nextSelectionId !== null) {
        setLeavePreferredRequestId(variables.nextSelectionId);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminRequests.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminAttendance.all,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leave.all }),
      ]);
    },
  });

  function handleViewChange(view: AdminRequestsView) {
    if (view === initialView) {
      return;
    }

    startRoutingTransition(() => {
      router.replace(buildRoute(view));
    });
  }

  function submitManualDecision(decision: AdminRequestDecisionBody) {
    if (manualSelectedItem === null) {
      return;
    }

    setManualErrorState({ message: null, selectionKey: "" });
    manualMutation.mutate({
      decision,
      nextSelectionId: getNextActionableSelection(
        filteredManualItems,
        manualSelectedItem.id,
      ),
      requestId: manualSelectedItem.id,
    });
  }

  function submitLeaveDecision(decision: AdminRequestDecisionBody) {
    if (leaveSelectedItem === null) {
      return;
    }

    setLeaveErrorState({ message: null, selectionKey: "" });
    leaveMutation.mutate({
      decision,
      nextSelectionId: getNextActionableSelection(
        filteredLeaveItems,
        leaveSelectedItem.id,
      ),
      requestId: leaveSelectedItem.id,
    });
  }

  const manualColumns: AdminRequestReviewTableColumn<ManualAdminRequestItem>[] =
    [
      {
        filter: {
          kind: "text",
          label: "이름",
          placeholder: "이름으로 검색해요",
          value: manualFilters.name,
          onChange: (value) =>
            setManualFilters((current) => ({ ...current, name: value })),
        },
        header: "이름",
        key: "employee",
        renderCell: (item) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {item.employee.name}
            </span>
            {item.governingReviewComment !== null ? (
              <span className="text-xs text-status-warning">
                이전 검토 사유가 남아 있어요
              </span>
            ) : null}
          </div>
        ),
      },
      {
        cellClassName: "text-foreground",
        filter: {
          kind: "text",
          label: "부서",
          placeholder: "부서로 필터해요",
          value: manualFilters.department,
          onChange: (value) =>
            setManualFilters((current) => ({ ...current, department: value })),
        },
        header: "부서",
        key: "department",
        renderCell: (item) => item.employee.department,
      },
      {
        filter: {
          kind: "select",
          label: "정정 종류",
          options: [...manualSubtypeOptions],
          value: manualFilters.subtype,
          onChange: (value) =>
            setManualFilters((current) => ({ ...current, subtype: value })),
        },
        header: "정정 종류",
        key: "subtype",
        renderCell: (item) => formatRequestSubtypeLabel(item),
      },
      {
        filter: {
          kind: "date_range",
          label: "대상일",
          from: manualFilters.targetDate.from,
          onFromChange: (value) =>
            setManualFilters((current) => ({
              ...current,
              targetDate: {
                ...current.targetDate,
                from: value,
                preset: "",
              },
            })),
          onPresetChange: (value) =>
            setManualFilters((current) => ({
              ...current,
              targetDate: buildDateRangeForPreset(value as DateRangePreset),
            })),
          onToChange: (value) =>
            setManualFilters((current) => ({
              ...current,
              targetDate: {
                ...current.targetDate,
                preset: "",
                to: value,
              },
            })),
          preset: manualFilters.targetDate.preset,
          presetOptions: [...dateRangePresetOptions],
          to: manualFilters.targetDate.to,
        },
        header: "대상일",
        key: "targetDate",
        renderCell: (item) => formatDateShortLabel(item.targetDate),
      },
      {
        filter: {
          kind: "select",
          label: "요청 상태",
          options: [...requestStatusOptions],
          value: manualFilters.status,
          onChange: (value) =>
            setManualFilters((current) => ({ ...current, status: value })),
        },
        header: "요청 상태",
        key: "status",
        renderCell: (item) => <StatusBadge status={item.status} />,
      },
      {
        cellClassName: "max-w-[280px] whitespace-normal",
        filter: {
          kind: "text",
          label: "사유",
          placeholder: "사유로 필터해요",
          value: manualFilters.reason,
          onChange: (value) =>
            setManualFilters((current) => ({ ...current, reason: value })),
        },
        header: "사유",
        key: "reason",
        renderCell: (item) => (
          <p className="line-clamp-2 text-sm leading-6 text-foreground">
            {item.reason}
          </p>
        ),
      },
    ];

  const leaveColumns: AdminRequestReviewTableColumn<LeaveAdminRequestItem>[] = [
    {
      filter: {
        kind: "text",
        label: "이름",
        placeholder: "이름으로 검색해요",
        value: leaveFilters.name,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, name: value })),
      },
      header: "이름",
      key: "employee",
      renderCell: (item) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">
            {item.employee.name}
          </span>
          {item.governingReviewComment !== null ? (
            <span className="text-xs text-status-warning">
              이전 검토 사유가 남아 있어요
            </span>
          ) : null}
        </div>
      ),
    },
    {
      cellClassName: "text-foreground",
      filter: {
        kind: "text",
        label: "부서",
        placeholder: "부서로 필터해요",
        value: leaveFilters.department,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, department: value })),
      },
      header: "부서",
      key: "department",
      renderCell: (item) => item.employee.department,
    },
    {
      filter: {
        kind: "select",
        label: "휴가 종류",
        options: [...leaveSubtypeOptions],
        value: leaveFilters.subtype,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, subtype: value })),
      },
      header: "휴가 종류",
      key: "subtype",
      renderCell: (item) => formatRequestSubtypeLabel(item),
    },
    {
      cellClassName: "font-medium tabular-nums text-foreground",
      filter: {
        kind: "text",
        label: "시간",
        placeholder: "13:00-15:00으로 필터해요",
        value: leaveFilters.time,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, time: value })),
      },
      header: "시간",
      key: "time",
      renderCell: (item) => getLeaveTimeLabel(item),
    },
    {
      filter: {
        kind: "date_range",
        label: "대상일",
        from: leaveFilters.targetDate.from,
        onFromChange: (value) =>
          setLeaveFilters((current) => ({
            ...current,
            targetDate: {
              ...current.targetDate,
              from: value,
              preset: "",
            },
          })),
        onPresetChange: (value) =>
          setLeaveFilters((current) => ({
            ...current,
            targetDate: buildDateRangeForPreset(value as DateRangePreset),
          })),
        onToChange: (value) =>
          setLeaveFilters((current) => ({
            ...current,
            targetDate: {
              ...current.targetDate,
              preset: "",
              to: value,
            },
          })),
        preset: leaveFilters.targetDate.preset,
        presetOptions: [...dateRangePresetOptions],
        to: leaveFilters.targetDate.to,
      },
      header: "대상일",
      key: "targetDate",
      renderCell: (item) => formatDateShortLabel(item.targetDate),
    },
    {
      filter: {
        kind: "select",
        label: "요청 상태",
        options: [...requestStatusOptions],
        value: leaveFilters.status,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, status: value })),
      },
      header: "요청 상태",
      key: "status",
      renderCell: (item) => <StatusBadge status={item.status} />,
    },
    {
      filter: {
        kind: "select",
        label: "운영 경고",
        options: [...leaveWarningOptions],
        value: leaveFilters.warning,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, warning: value })),
      },
      header: "운영 경고",
      key: "warning",
      renderCell: (item) => <WarningBadge item={item} />,
    },
    {
      cellClassName: "max-w-[280px] whitespace-normal",
      filter: {
        kind: "text",
        label: "사유",
        placeholder: "사유로 필터해요",
        value: leaveFilters.reason,
        onChange: (value) =>
          setLeaveFilters((current) => ({ ...current, reason: value })),
      },
      header: "사유",
      key: "reason",
      renderCell: (item) => (
        <p className="line-clamp-2 text-sm leading-6 text-foreground">
          {item.reason}
        </p>
      ),
    },
  ];

  const manualDetailPanelProps =
    manualSelectedItem === null
      ? null
      : buildDetailPanelProps(manualSelectedItem, {
          errorMessage: manualMutationError,
          isPending: manualMutation.isPending,
          isWarningConfirmationActive: false,
          onApprove: () => submitManualDecision({ decision: "approve" }),
          onCancelWarningConfirmation: () => undefined,
          onReject: () =>
            submitManualDecision({
              decision: "reject",
              reviewComment: manualReviewComment.trim(),
            }),
          onRequestCommentChange: (value) =>
            setManualReviewDraft({ selectionKey: manualSelectionKey, value }),
          onRequestRevision: () =>
            submitManualDecision({
              decision: "request_revision",
              reviewComment: manualReviewComment.trim(),
            }),
          onStartWarningConfirmation: () => undefined,
          reviewComment: manualReviewComment,
          reviewCommentInputId: "manual-request-review-comment",
        });

  const leaveDetailPanelProps =
    leaveSelectedItem === null
      ? null
      : buildDetailPanelProps(leaveSelectedItem, {
          errorMessage: leaveMutationError,
          isPending: leaveMutation.isPending,
          isWarningConfirmationActive: isLeaveWarningConfirmationActive,
          onApprove: () => submitLeaveDecision({ decision: "approve" }),
          onCancelWarningConfirmation: () =>
            setLeaveWarningState({
              isActive: false,
              selectionKey: leaveSelectionKey,
            }),
          onReject: () =>
            submitLeaveDecision({
              decision: "reject",
              reviewComment: leaveReviewComment.trim(),
            }),
          onRequestCommentChange: (value) =>
            setLeaveReviewDraft({ selectionKey: leaveSelectionKey, value }),
          onRequestRevision: () =>
            submitLeaveDecision({
              decision: "request_revision",
              reviewComment: leaveReviewComment.trim(),
            }),
          onStartWarningConfirmation: () =>
            setLeaveWarningState({
              isActive: true,
              selectionKey: leaveSelectionKey,
            }),
          reviewComment: leaveReviewComment,
          reviewCommentInputId: "leave-request-review-comment",
        });

  const isBusy =
    isRouting ||
    requestsQuery.isFetching ||
    manualMutation.isPending ||
    leaveMutation.isPending;

  return (
    <AdminRequestsScreen
      errorMessage={
        requestsQuery.isError ? getErrorMessage(requestsQuery.error) : null
      }
      hasQueryError={requestsQuery.isError}
      isBusy={isBusy}
      leaveSection={{
        columns: leaveColumns,
        description: "휴가 신청을 필요한 기준만 남겨서 살펴봐요",
        detailEmptyTitle:
          filteredLeaveItems.length === 0
            ? "조건에 맞는 휴가 신청이 없어요"
            : "휴가 신청을 선택하면 오른쪽에서 검토할 수 있어요",
        detailPanelProps: leaveDetailPanelProps,
        emptyDescription:
          "현재 탭과 필터 조건에 맞는 휴가 신청이 없어요. 검색어와 필터를 조정해 보세요.",
        emptyTitle: "표시할 휴가 신청이 없어요",
        items: filteredLeaveItems,
        onRequestSelect: setLeavePreferredRequestId,
        onResetFilters: () => setLeaveFilters(resetLeaveFilters()),
        selectedRequestId: leaveSelectedRequestId,
        title: "휴가 신청",
        totalCount: leaveItems.length,
      }}
      manualSection={{
        columns: manualColumns,
        description: "정정 신청을 필요한 기준만 남겨서 살펴봐요",
        detailEmptyTitle:
          filteredManualItems.length === 0
            ? "조건에 맞는 정정 신청이 없어요"
            : "정정 신청을 선택하면 오른쪽에서 검토할 수 있어요",
        detailPanelProps: manualDetailPanelProps,
        emptyDescription:
          "현재 탭과 필터 조건에 맞는 정정 신청이 없어요. 검색어와 필터를 조정해 보세요.",
        emptyTitle: "표시할 정정 신청이 없어요",
        items: filteredManualItems,
        onRequestSelect: setManualPreferredRequestId,
        onResetFilters: () => setManualFilters(resetManualFilters()),
        selectedRequestId: manualSelectedRequestId,
        title: "정정 신청",
        totalCount: manualItems.length,
      }}
      onViewChange={handleViewChange}
      view={initialView}
    />
  );
}
