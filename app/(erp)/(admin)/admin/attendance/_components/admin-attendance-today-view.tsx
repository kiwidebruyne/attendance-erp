"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";
import { cn } from "@/lib/utils";

import {
  formatDateLabel,
  formatMinutesLabel,
  formatTimeLabel,
  matchesDateRangeFilter,
  matchesTextFilter,
} from "../_lib/formatting";
import type {
  AdminAttendanceLedgerView,
  AdminAttendanceTodayExceptionRow,
} from "../_lib/today-exception-rows";
import { AdminAttendanceSummaryCards } from "./admin-attendance-summary-cards";
import { TableHeaderFilterButton } from "./table-header-filter";

type AdminAttendanceTodayViewProps = {
  exceptionRows: AdminAttendanceTodayExceptionRow[];
  name?: string;
  onNameChange?: (name: string) => void;
  response: AdminAttendanceTodayResponse;
};

type TodayItem = AdminAttendanceTodayResponse["items"][number];

type BadgeTone = "danger" | "info" | "neutral" | "success" | "warning";

type ItemBadge = Readonly<{
  label: string;
  tone: BadgeTone;
}>;

type DateRangeFilter = Readonly<{
  from: string;
  preset: string;
  to: string;
}>;

const ledgerViewOptions: ReadonlyArray<{
  label: string;
  value: AdminAttendanceLedgerView;
}> = [
  { label: "기본", value: "default" },
  { label: "근무상태별", value: "by-work-state" },
  { label: "근태상태별", value: "by-attendance-status" },
];

const emptyDateRangeFilter: DateRangeFilter = {
  from: "",
  preset: "",
  to: "",
};

type DateRangePreset = "" | "last_30_days" | "last_7_days" | "today";

const dateRangePresetOptions: ReadonlyArray<{
  label: string;
  value: DateRangePreset;
}> = [
  { label: "오늘", value: "today" },
  { label: "최근 7일", value: "last_7_days" },
  { label: "최근 30일", value: "last_30_days" },
];

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

function buildDateRangeForPreset(
  anchorDate: string,
  preset: DateRangePreset,
): DateRangeFilter {
  if (preset === "") {
    return emptyDateRangeFilter;
  }

  if (preset === "today") {
    return {
      from: anchorDate,
      preset,
      to: anchorDate,
    };
  }

  return {
    from: shiftSeoulDate(anchorDate, preset === "last_7_days" ? -6 : -29),
    preset,
    to: anchorDate,
  };
}

function getLeaveCoverageLabel(item: TodayItem) {
  switch (item.expectedWorkday.leaveCoverage?.leaveType) {
    case "annual":
      return "연차";
    case "half_am":
    case "half_pm":
      return "반차";
    case "hourly":
      return "시간차";
    default:
      return null;
  }
}

function getBadgeClassName(tone: BadgeTone) {
  if (tone === "danger") {
    return "bg-status-danger-soft text-status-danger";
  }

  if (tone === "warning") {
    return "bg-status-warning-soft text-status-warning";
  }

  if (tone === "info") {
    return "bg-status-info-soft text-status-info";
  }

  if (tone === "success") {
    return "bg-status-success-soft text-status-success";
  }

  return "bg-muted text-secondary";
}

function getItemBadges(item: TodayItem) {
  const badges: ItemBadge[] = [];
  const leaveCoverageLabel = getLeaveCoverageLabel(item);

  if (item.previousDayOpenRecord !== null) {
    badges.push({
      label: "전날 미퇴근",
      tone: "danger",
    });
  }

  if (item.latestFailedAttempt !== null) {
    badges.push({
      label: "시도 실패",
      tone: "warning",
    });
  }

  if (item.manualRequest !== null) {
    badges.push({
      label:
        item.manualRequest.status === "pending"
          ? "정정 요청 검토 중"
          : item.manualRequest.status === "revision_requested"
            ? "정정 요청 보완 필요"
            : "정정 요청 반려",
      tone: item.manualRequest.status === "pending" ? "info" : "warning",
    });
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    badges.push({
      label: "휴가 충돌",
      tone: "info",
    });
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    badges.push({
      label: "출근 기록 없음",
      tone: "danger",
    });
  }

  if (item.display.activeExceptions.includes("absent")) {
    badges.push({
      label: "결근",
      tone: "danger",
    });
  }

  if (item.display.flags.includes("late")) {
    badges.push({
      label: "지각",
      tone: "warning",
    });
  }

  if (item.display.flags.includes("early_leave")) {
    badges.push({
      label: "조퇴",
      tone: "warning",
    });
  }

  if (leaveCoverageLabel !== null) {
    badges.push({
      label: leaveCoverageLabel,
      tone: "info",
    });
  }

  const seen = new Set<string>();

  return badges.filter((badge) => {
    if (seen.has(badge.label)) {
      return false;
    }

    seen.add(badge.label);
    return true;
  });
}

function getCurrentStateLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return "전날 퇴근 기록이 아직 없어요";
  }

  if (item.latestFailedAttempt !== null) {
    return "출결 시도가 실패했어요";
  }

  if (item.manualRequest !== null) {
    if (item.manualRequest.status === "pending") {
      return "정정 요청을 검토 중이에요";
    }

    if (item.manualRequest.status === "revision_requested") {
      return "정정 요청 보완이 필요해요";
    }

    return "정정 요청이 반려됐어요";
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가와 실제 근무 기록이 함께 있어요";
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    return "오늘 출근 기록이 없어요";
  }

  if (item.display.activeExceptions.includes("absent")) {
    return "오늘 근무 기록이 비어 있어요";
  }

  if (
    item.display.flags.includes("late") &&
    item.display.flags.includes("early_leave")
  ) {
    return "지각과 조퇴가 함께 있어요";
  }

  if (item.display.flags.includes("late")) {
    return "오늘 지각이 기록됐어요";
  }

  if (item.display.flags.includes("early_leave")) {
    return "오늘 조퇴가 기록됐어요";
  }

  const leaveCoverageLabel = getLeaveCoverageLabel(item);

  if (leaveCoverageLabel !== null) {
    return `${leaveCoverageLabel}가 반영됐어요`;
  }

  if (item.display.phase === "working") {
    return "지금 근무중이에요";
  }

  if (item.display.phase === "checked_out") {
    return "오늘 근무를 마쳤어요";
  }

  return "아직 출근 전이에요";
}

function getContextLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return `대상일 ${formatDateLabel(item.previousDayOpenRecord.date)} · 전날 출근 ${formatTimeLabel(item.previousDayOpenRecord.clockInAt)} / 예상 퇴근 ${formatTimeLabel(item.previousDayOpenRecord.expectedClockOutAt)}`;
  }

  if (item.latestFailedAttempt !== null) {
    return `마지막 시도 ${formatTimeLabel(item.latestFailedAttempt.attemptedAt)} · ${item.latestFailedAttempt.failureReason.replace(/[.。]\s*$/, "")}`;
  }

  if (item.manualRequest !== null) {
    if (item.manualRequest.governingReviewComment !== null) {
      return item.manualRequest.governingReviewComment;
    }

    return `대상일 ${formatDateLabel(item.manualRequest.date)} · ${formatTimeLabel(item.manualRequest.submittedAt)} 제출`;
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가 일정과 실제 출결이 함께 보여요";
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    return `예상 출근 ${formatTimeLabel(item.expectedWorkday.adjustedClockInAt)} 이후에도 기록이 없어요`;
  }

  if (item.display.activeExceptions.includes("absent")) {
    return "출근과 퇴근 기록 모두 다시 확인이 필요해요";
  }

  if (item.display.flags.includes("late")) {
    return `출근 ${formatTimeLabel(item.todayRecord?.clockInAt ?? null)} · 퇴근 ${formatTimeLabel(item.todayRecord?.clockOutAt ?? null)}`;
  }

  if (item.display.flags.includes("early_leave")) {
    return `출근 ${formatTimeLabel(item.todayRecord?.clockInAt ?? null)} · 퇴근 ${formatTimeLabel(item.todayRecord?.clockOutAt ?? null)}`;
  }

  const leaveCoverageLabel = getLeaveCoverageLabel(item);

  if (leaveCoverageLabel !== null) {
    return `${leaveCoverageLabel} 일정이 오늘 근무 시간에 반영돼 있어요`;
  }

  if (item.todayRecord !== null) {
    return `출근 ${formatTimeLabel(item.todayRecord.clockInAt)} · 퇴근 ${formatTimeLabel(item.todayRecord.clockOutAt)}`;
  }

  return "오늘 근무현황을 확인해요";
}

function getNextCheckLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return "전날 퇴근 기록 확인";
  }

  if (item.latestFailedAttempt !== null) {
    return "실패한 시도 확인";
  }

  if (item.manualRequest !== null) {
    return "정정 요청 상태 확인";
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가와 출결 비교";
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    return "출근 기록 확인";
  }

  if (item.display.activeExceptions.includes("absent")) {
    return "출근과 퇴근 기록 재확인";
  }

  if (item.display.flags.includes("late")) {
    return "지각 사유 확인";
  }

  if (item.display.flags.includes("early_leave")) {
    return "조퇴 사유 확인";
  }

  return "오늘 근무현황 확인";
}

function getWorkedMinutesBetween(startAt: string, endAt: string) {
  const startedAt = new Date(startAt).getTime();
  const finishedAt = new Date(endAt).getTime();

  if (
    Number.isNaN(startedAt) ||
    Number.isNaN(finishedAt) ||
    finishedAt < startedAt
  ) {
    return null;
  }

  return Math.floor((finishedAt - startedAt) / 60_000);
}

function getResolvedWorkMinutes(item: TodayItem, now: string) {
  if (
    item.todayRecord?.workMinutes !== null &&
    item.todayRecord?.workMinutes !== undefined
  ) {
    return item.todayRecord.workMinutes;
  }

  if (
    item.display.phase !== "working" ||
    item.todayRecord?.clockInAt === null ||
    item.todayRecord?.clockInAt === undefined
  ) {
    return null;
  }

  return getWorkedMinutesBetween(item.todayRecord.clockInAt, now);
}

function getTotalWorkTimeLabel(item: TodayItem, now: string) {
  return formatCompactMinutesLabel(getResolvedWorkMinutes(item, now));
}

function formatCompactTimeLabel(value: string | null) {
  return value === null ? "-" : formatTimeLabel(value);
}

function formatCompactMinutesLabel(value: number | null) {
  return value === null ? "-" : formatMinutesLabel(value);
}

function getLedgerRowToneClass(item: TodayItem) {
  if (
    item.previousDayOpenRecord !== null ||
    item.display.activeExceptions.includes("not_checked_in") ||
    item.display.activeExceptions.includes("absent")
  ) {
    return "bg-status-danger-soft/28 hover:bg-status-danger-soft/40";
  }

  if (
    item.latestFailedAttempt !== null ||
    item.display.flags.includes("late") ||
    item.display.flags.includes("early_leave") ||
    item.manualRequest !== null
  ) {
    return "bg-status-warning-soft/22 hover:bg-status-warning-soft/34";
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "bg-status-info-soft/38 hover:bg-status-info-soft/50";
  }

  return "";
}

function getExceptionRowToneClass(row: AdminAttendanceTodayExceptionRow) {
  if (row.specialNote !== "-" || row.exceptionType.includes("결근")) {
    return "bg-status-danger-soft/28 hover:bg-status-danger-soft/40";
  }

  if (
    row.exceptionType.includes("실패") ||
    row.exceptionType.includes("반려") ||
    row.exceptionType.includes("검토")
  ) {
    return "bg-status-warning-soft/22 hover:bg-status-warning-soft/34";
  }

  if (row.exceptionType.includes("휴가")) {
    return "bg-status-info-soft/38 hover:bg-status-info-soft/50";
  }

  return "";
}

function getWorkStateGroupKey(item: TodayItem) {
  if (item.expectedWorkday.leaveCoverage !== null) {
    return "on-leave";
  }

  if (item.display.phase === "working") {
    return "working";
  }

  if (item.display.phase === "checked_out") {
    return "checked-out";
  }

  return "before-check-in";
}

function getAttendanceStatusGroupKeys(item: TodayItem) {
  const groups: Array<"early-leave" | "late" | "normal"> = [];

  if (item.display.flags.includes("late")) {
    groups.push("late");
  }

  if (item.display.flags.includes("early_leave")) {
    groups.push("early-leave");
  }

  if (groups.length === 0) {
    groups.push("normal");
  }

  return groups;
}

function StatusBadges({ item }: Readonly<{ item: TodayItem }>) {
  const badges = getItemBadges(item);

  if (badges.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Badge
          key={`${item.employee.id}-${badge.label}`}
          className={getBadgeClassName(badge.tone)}
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

function SelectionSummaryPanel({ item }: Readonly<{ item: TodayItem | null }>) {
  if (item === null) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{item.employee.name}</CardTitle>
          <Badge variant="outline">{item.employee.department}</Badge>
        </div>
        <CardDescription>{getCurrentStateLabel(item)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">현재 상태</p>
          <p className="text-sm leading-6 text-foreground">
            {getCurrentStateLabel(item)}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">사유</p>
          <p className="text-sm leading-6 text-foreground">
            {getContextLabel(item)}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            다음 확인 포인트
          </p>
          <p className="text-sm leading-6 text-foreground">
            {getNextCheckLabel(item)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExceptionTable({
  hasAnyRows,
  name,
  onNameChange,
  onSelectRow,
  pageDate,
  rows,
  selectedRowId,
}: Readonly<{
  hasAnyRows: boolean;
  name?: string;
  onNameChange?: (name: string) => void;
  onSelectRow: (row: AdminAttendanceTodayExceptionRow) => void;
  pageDate: string;
  rows: AdminAttendanceTodayExceptionRow[];
  selectedRowId: string | null;
}>) {
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [detailFilter, setDetailFilter] = useState("");
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState("");
  const [referenceDateFilter, setReferenceDateFilter] =
    useState<DateRangeFilter>(emptyDateRangeFilter);
  const [specialNoteFilter, setSpecialNoteFilter] = useState("");

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesTextFilter(row.department, departmentFilter) &&
          matchesTextFilter(row.exceptionType, exceptionTypeFilter) &&
          matchesTextFilter(row.specialNote, specialNoteFilter) &&
          matchesDateRangeFilter(
            row.referenceDate,
            referenceDateFilter.from,
            referenceDateFilter.to,
          ) &&
          matchesTextFilter(row.detail, detailFilter),
      ),
    [
      detailFilter,
      departmentFilter,
      exceptionTypeFilter,
      referenceDateFilter.from,
      referenceDateFilter.to,
      rows,
      specialNoteFilter,
    ],
  );

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center gap-2">
          <TriangleAlertIcon
            aria-hidden="true"
            className="size-4 text-status-danger"
          />
          <CardTitle>누적 예외</CardTitle>
          <Badge className="bg-status-danger-soft text-status-danger">
            {filteredRows.length}
          </Badge>
        </div>
        <CardDescription>
          열 제목에서 바로 조건을 바꾸면서 아직 해소되지 않은 예외를 좁혀봐요
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {!hasAnyRows ? (
          <Empty className="rounded-none border-0">
            <EmptyHeader>
              <EmptyTitle>지금 누적 예외가 없어요</EmptyTitle>
              <EmptyDescription>
                새로운 예외가 생기면 이 표에서 먼저 보여줘요
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "직원",
                        placeholder: "이름으로 찾아요",
                        value: name ?? "",
                        onChange: (value) => onNameChange?.(value),
                      }}
                      header="직원"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "부서",
                        placeholder: "부서로 찾아요",
                        value: departmentFilter,
                        onChange: setDepartmentFilter,
                      }}
                      header="부서"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "예외 유형",
                        placeholder: "예외 유형으로 찾아요",
                        value: exceptionTypeFilter,
                        onChange: setExceptionTypeFilter,
                      }}
                      header="예외 유형"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "특이사항",
                        placeholder: "특이사항으로 찾아요",
                        value: specialNoteFilter,
                        onChange: setSpecialNoteFilter,
                      }}
                      header="특이사항"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "date_range",
                        from: referenceDateFilter.from,
                        label: "기준일",
                        onClear: () =>
                          setReferenceDateFilter(emptyDateRangeFilter),
                        onFromChange: (value) =>
                          setReferenceDateFilter((current) => ({
                            ...current,
                            from: value,
                            preset: "",
                          })),
                        onPresetChange: (value) =>
                          setReferenceDateFilter(
                            buildDateRangeForPreset(
                              pageDate,
                              value as DateRangePreset,
                            ),
                          ),
                        onToChange: (value) =>
                          setReferenceDateFilter((current) => ({
                            ...current,
                            preset: "",
                            to: value,
                          })),
                        preset: referenceDateFilter.preset,
                        presetOptions: dateRangePresetOptions,
                        to: referenceDateFilter.to,
                      }}
                      header="기준일"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "상세",
                        placeholder: "상세 내용으로 찾아요",
                        value: detailFilter,
                        onChange: setDetailFilter,
                      }}
                      header="상세"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      조건에 맞는 예외가 없어요. 열 제목 필터를 초기화하면 다른
                      누적 예외를 바로 볼 수 있어요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const isSelected = row.id === selectedRowId;

                    return (
                      <TableRow
                        key={row.id}
                        aria-selected={isSelected}
                        className={cn(
                          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                          getExceptionRowToneClass(row),
                          isSelected &&
                            "bg-primary/8 hover:bg-primary/10 data-[state=selected]:bg-primary/8",
                        )}
                        data-state={isSelected ? "selected" : undefined}
                        tabIndex={0}
                        onClick={() => onSelectRow(row)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }

                          event.preventDefault();
                          onSelectRow(row);
                        }}
                      >
                        <TableCell className="font-medium text-foreground">
                          {row.employeeName}
                        </TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{row.exceptionType}</TableCell>
                        <TableCell>{row.specialNote}</TableCell>
                        <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                          {formatDateLabel(row.referenceDate)}
                        </TableCell>
                        <TableCell className="min-w-[280px] text-secondary">
                          {row.detail}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LedgerTable({
  name,
  onNameChange,
  items,
  now,
  onSelectEmployee,
  selectedEmployeeId,
}: Readonly<{
  name?: string;
  onNameChange?: (name: string) => void;
  items: TodayItem[];
  now: string;
  onSelectEmployee: (employeeId: string) => void;
  selectedEmployeeId: string | null;
}>) {
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [clockInFilter, setClockInFilter] = useState("");
  const [clockOutFilter, setClockOutFilter] = useState("");
  const [currentStateFilter, setCurrentStateFilter] = useState("");
  const [nextCheckFilter, setNextCheckFilter] = useState("");
  const [workTimeFilter, setWorkTimeFilter] = useState("");

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesTextFilter(item.employee.department, departmentFilter) &&
          matchesTextFilter(getCurrentStateLabel(item), currentStateFilter) &&
          matchesTextFilter(
            formatCompactTimeLabel(item.todayRecord?.clockInAt ?? null),
            clockInFilter,
          ) &&
          matchesTextFilter(
            formatCompactTimeLabel(item.todayRecord?.clockOutAt ?? null),
            clockOutFilter,
          ) &&
          matchesTextFilter(getTotalWorkTimeLabel(item, now), workTimeFilter) &&
          matchesTextFilter(getNextCheckLabel(item), nextCheckFilter),
      ),
    [
      clockInFilter,
      clockOutFilter,
      currentStateFilter,
      departmentFilter,
      items,
      nextCheckFilter,
      now,
      workTimeFilter,
    ],
  );

  if (items.length === 0) {
    return (
      <Empty className="border border-border bg-card">
        <EmptyHeader>
          <EmptyTitle>근무현황 항목이 없어요</EmptyTitle>
          <EmptyDescription>
            다른 view에서 전체 근무현황을 계속 볼 수 있어요
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "직원",
                  placeholder: "이름으로 찾아요",
                  value: name ?? "",
                  onChange: (value) => onNameChange?.(value),
                }}
                header="직원"
              />
            </TableHead>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "부서",
                  placeholder: "부서로 찾아요",
                  value: departmentFilter,
                  onChange: setDepartmentFilter,
                }}
                header="부서"
              />
            </TableHead>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "현재 상태",
                  placeholder: "현재 상태로 찾아요",
                  value: currentStateFilter,
                  onChange: setCurrentStateFilter,
                }}
                header="현재 상태"
              />
            </TableHead>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "출근",
                  placeholder: "출근 시간으로 찾아요",
                  value: clockInFilter,
                  onChange: setClockInFilter,
                }}
                header="출근"
              />
            </TableHead>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "퇴근",
                  placeholder: "퇴근 시간으로 찾아요",
                  value: clockOutFilter,
                  onChange: setClockOutFilter,
                }}
                header="퇴근"
              />
            </TableHead>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "총 근무시간",
                  placeholder: "근무시간으로 찾아요",
                  value: workTimeFilter,
                  onChange: setWorkTimeFilter,
                }}
                header="총 근무시간"
              />
            </TableHead>
            <TableHead className="p-1">
              <TableHeaderFilterButton
                control={{
                  kind: "text",
                  label: "다음 확인",
                  placeholder: "다음 확인으로 찾아요",
                  value: nextCheckFilter,
                  onChange: setNextCheckFilter,
                }}
                header="다음 확인"
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.length === 0 ? (
            <TableRow>
              <TableCell
                className="py-10 text-center text-sm text-muted-foreground"
                colSpan={7}
              >
                조건에 맞는 근무현황이 없어요. 열 제목의 필터를 지우면 다른
                근무현황을 다시 볼 수 있어요.
              </TableCell>
            </TableRow>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.employee.id === selectedEmployeeId;

              return (
                <TableRow
                  key={item.employee.id}
                  aria-selected={isSelected}
                  className={cn(
                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                    getLedgerRowToneClass(item),
                    isSelected &&
                      "bg-primary/8 hover:bg-primary/10 data-[state=selected]:bg-primary/8",
                  )}
                  data-state={isSelected ? "selected" : undefined}
                  tabIndex={0}
                  onClick={() => onSelectEmployee(item.employee.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }

                    event.preventDefault();
                    onSelectEmployee(item.employee.id);
                  }}
                >
                  <TableCell className="font-medium text-foreground">
                    {item.employee.name}
                  </TableCell>
                  <TableCell>{item.employee.department}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col gap-2">
                      <p className="font-medium text-foreground">
                        {getCurrentStateLabel(item)}
                      </p>
                      <StatusBadges item={item} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                    {formatCompactTimeLabel(
                      item.todayRecord?.clockInAt ?? null,
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                    {formatCompactTimeLabel(
                      item.todayRecord?.clockOutAt ?? null,
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                    {getTotalWorkTimeLabel(item, now)}
                  </TableCell>
                  <TableCell className="whitespace-normal text-secondary">
                    {getNextCheckLabel(item)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function LedgerSection({
  description,
  items,
  now,
  name,
  onSelectEmployee,
  onNameChange,
  selectedEmployeeId,
  title,
}: Readonly<{
  description: string;
  items: TodayItem[];
  now: string;
  name?: string;
  onSelectEmployee: (employeeId: string) => void;
  onNameChange?: (name: string) => void;
  selectedEmployeeId: string | null;
  title: string;
}>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="outline">{items.length}명</Badge>
      </div>

      {items.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>{title} 항목이 없어요</EmptyTitle>
            <EmptyDescription>
              다른 view에서 전체 근무현황을 계속 볼 수 있어요
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <LedgerTable
          name={name}
          items={items}
          now={now}
          onNameChange={onNameChange}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
        />
      )}
    </div>
  );
}

function LedgerContent({
  items,
  now,
  name,
  onSelectEmployee,
  onNameChange,
  selectedEmployeeId,
  view,
}: Readonly<{
  items: TodayItem[];
  now: string;
  name?: string;
  onSelectEmployee: (employeeId: string) => void;
  onNameChange?: (name: string) => void;
  selectedEmployeeId: string | null;
  view: AdminAttendanceLedgerView;
}>) {
  if (items.length === 0) {
    return (
      <Empty className="border border-border bg-card">
        <EmptyHeader>
          <EmptyTitle>검색 결과가 없어요</EmptyTitle>
          <EmptyDescription>
            다른 이름으로 찾아보거나 검색어를 지우면 전체 근무현황을 다시 볼 수
            있어요
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (view === "default") {
    return (
      <LedgerTable
        name={name}
        items={items}
        now={now}
        onNameChange={onNameChange}
        onSelectEmployee={onSelectEmployee}
        selectedEmployeeId={selectedEmployeeId}
      />
    );
  }

  if (view === "by-work-state") {
    const leaveItems = items.filter(
      (item) => getWorkStateGroupKey(item) === "on-leave",
    );
    const workingItems = items.filter(
      (item) => getWorkStateGroupKey(item) === "working",
    );
    const beforeCheckInItems = items.filter(
      (item) => getWorkStateGroupKey(item) === "before-check-in",
    );
    const checkedOutItems = items.filter(
      (item) => getWorkStateGroupKey(item) === "checked-out",
    );

    return (
      <div className="flex flex-col gap-8">
        <LedgerSection
          description="휴가가 반영된 인원만 모아봐요"
          items={leaveItems}
          now={now}
          name={name}
          title="휴가중"
          onNameChange={onNameChange}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
        />
        <LedgerSection
          description="현재 근무중인 인원이에요"
          items={workingItems}
          now={now}
          name={name}
          title="근무중"
          onNameChange={onNameChange}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
        />
        <LedgerSection
          description="아직 출근 전으로 보이는 인원이에요"
          items={beforeCheckInItems}
          now={now}
          name={name}
          title="출근 전"
          onNameChange={onNameChange}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
        />
        <LedgerSection
          description="오늘 근무를 마친 인원이에요"
          items={checkedOutItems}
          now={now}
          name={name}
          title="퇴근"
          onNameChange={onNameChange}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
        />
      </div>
    );
  }

  const normalItems = items.filter((item) =>
    getAttendanceStatusGroupKeys(item).includes("normal"),
  );
  const lateItems = items.filter((item) =>
    getAttendanceStatusGroupKeys(item).includes("late"),
  );
  const earlyLeaveItems = items.filter((item) =>
    getAttendanceStatusGroupKeys(item).includes("early-leave"),
  );

  return (
    <div className="flex flex-col gap-8">
      <LedgerSection
        description="지각이나 조퇴 플래그가 없는 인원이에요"
        items={normalItems}
        now={now}
        name={name}
        title="정상"
        onNameChange={onNameChange}
        onSelectEmployee={onSelectEmployee}
        selectedEmployeeId={selectedEmployeeId}
      />
      <LedgerSection
        description="지각 플래그가 있는 인원이에요"
        items={lateItems}
        now={now}
        name={name}
        title="지각"
        onNameChange={onNameChange}
        onSelectEmployee={onSelectEmployee}
        selectedEmployeeId={selectedEmployeeId}
      />
      <LedgerSection
        description="조퇴 플래그가 있는 인원이에요"
        items={earlyLeaveItems}
        now={now}
        name={name}
        title="조퇴"
        onNameChange={onNameChange}
        onSelectEmployee={onSelectEmployee}
        selectedEmployeeId={selectedEmployeeId}
      />
    </div>
  );
}

function LedgerPanel({
  items,
  name,
  onNameChange,
  onSelectEmployee,
  selectedEmployeeId,
  setLedgerView,
  view,
}: Readonly<{
  items: TodayItem[];
  name?: string;
  onNameChange?: (name: string) => void;
  onSelectEmployee: (employeeId: string) => void;
  selectedEmployeeId: string | null;
  setLedgerView: (view: AdminAttendanceLedgerView) => void;
  view: AdminAttendanceLedgerView;
}>) {
  const [now, setNow] = useState(() => new Date().toISOString());
  const selectedItem =
    selectedEmployeeId === null
      ? null
      : (items.find((item) => item.employee.id === selectedEmployeeId) ?? null);

  useEffect(() => {
    const syncNow = () => {
      setNow(new Date().toISOString());
    };

    syncNow();

    const timerId = window.setInterval(syncNow, 60_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  return (
    <Card className="scroll-mt-20" id="today-ledger">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>전체 팀 근무현황</CardTitle>
            <CardDescription>
              오늘 근무현황을 기본 view 또는 상태별 view로 나눠서 봐요
            </CardDescription>
          </div>
          <ToggleGroup
            className="rounded-[8px] border border-border/80 bg-muted/75 p-1"
            spacing={1}
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value === "" || value === view) {
                return;
              }

              setLedgerView(value as AdminAttendanceLedgerView);
            }}
          >
            {ledgerViewOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                className="rounded-[8px]"
                value={option.value}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <SelectionSummaryPanel item={selectedItem} />

        {selectedItem === null ? null : <Separator />}

        <LedgerContent
          items={items}
          now={now}
          name={name}
          onNameChange={onNameChange}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
          view={view}
        />
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{items.length}명을 표시하고 있어요</span>
        <span>
          {name === undefined || name.trim().length === 0
            ? "검색어 없음"
            : `검색어 ${name}`}
        </span>
      </CardFooter>
    </Card>
  );
}

export function AdminAttendanceTodayView({
  exceptionRows,
  name,
  onNameChange,
  response,
}: AdminAttendanceTodayViewProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [selectedExceptionRowId, setSelectedExceptionRowId] = useState<
    string | null
  >(null);
  const [ledgerView, setLedgerView] =
    useState<AdminAttendanceLedgerView>("default");

  const trimmedName = name?.trim() ?? "";
  const visibleItems =
    trimmedName.length === 0
      ? response.items
      : response.items.filter((item) =>
          matchesTextFilter(
            `${item.employee.name} ${item.employee.department}`,
            trimmedName,
          ),
        );
  const visibleExceptionRows =
    trimmedName.length === 0
      ? exceptionRows
      : exceptionRows.filter((row) =>
          matchesTextFilter(
            `${row.employeeName} ${row.department}`,
            trimmedName,
          ),
        );

  return (
    <div className="flex flex-col gap-6">
      <ExceptionTable
        hasAnyRows={exceptionRows.length > 0}
        name={name}
        onNameChange={onNameChange}
        pageDate={response.date}
        rows={visibleExceptionRows}
        selectedRowId={selectedExceptionRowId}
        onSelectRow={(row) => {
          setSelectedExceptionRowId(row.id);
          setSelectedEmployeeId(row.employeeId);
        }}
      />

      <AdminAttendanceSummaryCards items={visibleItems} />

      <LedgerPanel
        items={visibleItems}
        name={name}
        onNameChange={onNameChange}
        onSelectEmployee={(employeeId) => {
          setSelectedEmployeeId(employeeId);
          setSelectedExceptionRowId(null);
        }}
        selectedEmployeeId={selectedEmployeeId}
        setLedgerView={setLedgerView}
        view={ledgerView}
      />
    </div>
  );
}
