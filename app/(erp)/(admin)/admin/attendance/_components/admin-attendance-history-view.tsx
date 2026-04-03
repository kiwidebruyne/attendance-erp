"use client";

import { useMemo, useState } from "react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAttendanceListResponse } from "@/lib/contracts/admin-attendance";
import { cn } from "@/lib/utils";

import {
  formatDateShortLabel,
  formatMinutesLabel,
  formatTimeLabel,
  matchesDateRangeFilter,
  matchesTextFilter,
} from "../_lib/formatting";
import { TableHeaderFilterButton } from "./table-header-filter";

type AdminAttendanceHistoryViewProps = {
  from: string;
  name?: string;
  onFromChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToChange: (value: string) => void;
  response: AdminAttendanceListResponse;
  to: string;
};

type HistoryRecord = AdminAttendanceListResponse["records"][number];

type HistoryStatusChip = Readonly<{
  className: string;
  label: string;
}>;

type HistoryTableFilters = Readonly<{
  clockIn: string;
  clockOut: string;
  expectedWindow: string;
  status: string;
  workMinutes: string;
}>;

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

function buildDateRangeForPreset(anchorDate: string, preset: DateRangePreset) {
  if (preset === "today") {
    return {
      from: anchorDate,
      preset,
      to: anchorDate,
    };
  }

  if (preset === "last_7_days") {
    return {
      from: shiftSeoulDate(anchorDate, -6),
      preset,
      to: anchorDate,
    };
  }

  if (preset === "last_30_days") {
    return {
      from: shiftSeoulDate(anchorDate, -29),
      preset,
      to: anchorDate,
    };
  }

  return {
    from: "",
    preset: "",
    to: "",
  };
}

function getExpectedWindowLabel(record: HistoryRecord) {
  if (
    !record.expectedWorkday.isWorkday &&
    record.expectedWorkday.leaveCoverage === null
  ) {
    return "휴일";
  }

  if (
    record.expectedWorkday.adjustedClockInAt === null &&
    record.expectedWorkday.adjustedClockOutAt === null
  ) {
    return "휴가 반영";
  }

  if (
    record.expectedWorkday.adjustedClockInAt === null ||
    record.expectedWorkday.adjustedClockOutAt === null
  ) {
    return "-";
  }

  return `${formatTimeLabel(record.expectedWorkday.adjustedClockInAt)} ~ ${formatTimeLabel(record.expectedWorkday.adjustedClockOutAt)}`;
}

function getHistoryStatusSearchText(record: HistoryRecord) {
  const status = getHistoryStatusChips(record);

  return [
    getHistorySummaryLabel(record),
    ...status.chips.map((chip) => chip.label),
  ]
    .join(" ")
    .trim();
}

function getHistoryStatusChips(record: HistoryRecord) {
  const chips: HistoryStatusChip[] = [];
  const exceptions = new Set(record.display.activeExceptions);
  const hasDangerousException =
    exceptions.has("attempt_failed") ||
    exceptions.has("not_checked_in") ||
    exceptions.has("absent") ||
    exceptions.has("previous_day_checkout_missing") ||
    exceptions.has("leave_work_conflict") ||
    exceptions.has("manual_request_pending") ||
    exceptions.has("manual_request_rejected");
  const hasWarningFlag =
    record.display.flags.includes("late") ||
    record.display.flags.includes("early_leave");

  if (hasDangerousException) {
    chips.push({
      className:
        "border-status-danger/20 bg-status-danger-soft text-status-danger",
      label: "정정 필요",
    });
  }

  if (exceptions.has("absent")) {
    chips.push({
      className:
        "border-status-danger/20 bg-status-danger-soft text-status-danger",
      label: "결근",
    });
  }

  if (record.display.flags.includes("late")) {
    chips.push({
      className:
        "border-status-warning/20 bg-status-warning-soft text-status-warning",
      label: "지각",
    });
  }

  if (record.display.flags.includes("early_leave")) {
    chips.push({
      className:
        "border-status-warning/20 bg-status-warning-soft text-status-warning",
      label: "조퇴",
    });
  }

  if (chips.length === 0) {
    chips.push({
      className:
        "border-status-success/20 bg-status-success-soft text-status-success",
      label: "정상",
    });
  }

  return {
    chips,
    hasDangerousException,
    hasWarningFlag,
  };
}

function getHistorySummaryLabel(record: HistoryRecord) {
  if (
    record.display.activeExceptions.includes("previous_day_checkout_missing")
  ) {
    return "전날 미퇴근";
  }

  if (record.display.activeExceptions.includes("attempt_failed")) {
    return "시도 실패";
  }

  if (record.display.activeExceptions.includes("manual_request_pending")) {
    return "정정 요청 검토 중";
  }

  if (record.display.activeExceptions.includes("manual_request_rejected")) {
    return "정정 요청 반려";
  }

  if (record.display.activeExceptions.includes("absent")) {
    return "결근";
  }

  if (record.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가·출결 충돌";
  }

  if (record.display.activeExceptions.includes("not_checked_in")) {
    return "출근 기록 없음";
  }

  if (
    record.display.flags.includes("late") &&
    record.display.flags.includes("early_leave")
  ) {
    return "지각 · 조퇴";
  }

  if (record.display.flags.includes("late")) {
    return "지각";
  }

  if (record.display.flags.includes("early_leave")) {
    return "조퇴";
  }

  if (record.display.phase === "checked_out") {
    return "근무 완료";
  }

  if (record.display.phase === "working") {
    return "근무 중";
  }

  if (record.display.phase === "non_workday") {
    return "비근무일";
  }

  return "출근 전";
}

function getRowToneClass(record: HistoryRecord) {
  const status = getHistoryStatusChips(record);

  if (status.hasDangerousException) {
    return "bg-status-danger-soft/35 hover:bg-status-danger-soft/50";
  }

  if (status.hasWarningFlag) {
    return "bg-status-warning-soft/24 hover:bg-status-warning-soft/38";
  }

  return null;
}

function StatusChip({
  className,
  label,
}: Readonly<{
  className: string;
  label: string;
}>) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-full px-2.5 text-[11px] font-medium shadow-none",
        className,
      )}
      variant="ghost"
    >
      {label}
    </Badge>
  );
}

function formatLedgerTimeLabel(value: string | null) {
  return value === null ? "-" : formatTimeLabel(value);
}

function formatLedgerMinutesLabel(value: number | null) {
  return value === null ? "-" : formatMinutesLabel(value);
}

function getDateRangeLabel(from: string, to: string) {
  if (from.length === 0 && to.length === 0) {
    return "전체";
  }

  if (from.length === 0) {
    return `${formatDateShortLabel(to)} 이전`;
  }

  if (to.length === 0) {
    return `${formatDateShortLabel(from)} 이후`;
  }

  return `${formatDateShortLabel(from)} ~ ${formatDateShortLabel(to)}`;
}

export function AdminAttendanceHistoryView({
  from,
  name,
  onFromChange,
  onNameChange,
  onToChange,
  response,
  to,
}: AdminAttendanceHistoryViewProps) {
  const [filters, setFilters] = useState<HistoryTableFilters>({
    clockIn: "",
    clockOut: "",
    expectedWindow: "",
    status: "",
    workMinutes: "",
  });
  const records = useMemo(
    () =>
      [...response.records].sort((left, right) =>
        right.date.localeCompare(left.date),
      ),
    [response.records],
  );
  const visibleRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          matchesTextFilter(record.employee.name, name ?? "") &&
          matchesDateRangeFilter(record.date, from, to) &&
          matchesTextFilter(
            getExpectedWindowLabel(record),
            filters.expectedWindow,
          ) &&
          matchesTextFilter(
            formatLedgerTimeLabel(record.record?.clockInAt ?? null),
            filters.clockIn,
          ) &&
          matchesTextFilter(
            formatLedgerTimeLabel(record.record?.clockOutAt ?? null),
            filters.clockOut,
          ) &&
          matchesTextFilter(
            formatLedgerMinutesLabel(record.record?.workMinutes ?? null),
            filters.workMinutes,
          ) &&
          matchesTextFilter(getHistoryStatusSearchText(record), filters.status),
      ),
    [filters, from, name, records, to],
  );
  const anchorDate = response.to;
  const dateRangePreset =
    from === anchorDate && to === anchorDate
      ? "today"
      : from === shiftSeoulDate(anchorDate, -6) && to === anchorDate
        ? "last_7_days"
        : from === shiftSeoulDate(anchorDate, -29) && to === anchorDate
          ? "last_30_days"
          : "";

  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden="true" className="sr-only">
        <input
          readOnly
          tabIndex={-1}
          type="search"
          value={name ?? ""}
          onChange={() => undefined}
        />
        <input
          readOnly
          tabIndex={-1}
          type="date"
          value={from}
          onChange={() => undefined}
        />
        <input
          readOnly
          tabIndex={-1}
          type="date"
          value={to}
          onChange={() => undefined}
        />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>근태 이력</CardTitle>
              <CardDescription>
                열 제목을 눌러 날짜, 이름, 시간, 상태를 바로 좁혀요
              </CardDescription>
            </div>
            <Badge
              className="border-border bg-white text-secondary"
              variant="outline"
            >
              {visibleRecords.length}건
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "date_range",
                        from,
                        label: "날짜",
                        onFromChange: (value) => onFromChange(value),
                        onPresetChange: (value) => {
                          const nextRange = buildDateRangeForPreset(
                            anchorDate,
                            value as DateRangePreset,
                          );
                          onFromChange(nextRange.from);
                          onToChange(nextRange.to);
                        },
                        onToChange: (value) => onToChange(value),
                        preset: dateRangePreset,
                        presetOptions: dateRangePresetOptions,
                        to,
                      }}
                      header="날짜"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "이름",
                        placeholder: "이름으로 찾아요",
                        value: name ?? "",
                        onChange: (value) => onNameChange(value),
                      }}
                      header="이름"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "기준 시간",
                        placeholder: "기준 시간으로 찾아요",
                        value: filters.expectedWindow,
                        onChange: (value) =>
                          setFilters((current) => ({
                            ...current,
                            expectedWindow: value,
                          })),
                      }}
                      header="기준 시간"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "출근",
                        placeholder: "출근 시간으로 찾아요",
                        value: filters.clockIn,
                        onChange: (value) =>
                          setFilters((current) => ({
                            ...current,
                            clockIn: value,
                          })),
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
                        value: filters.clockOut,
                        onChange: (value) =>
                          setFilters((current) => ({
                            ...current,
                            clockOut: value,
                          })),
                      }}
                      header="퇴근"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "근무 시간",
                        placeholder: "근무 시간으로 찾아요",
                        value: filters.workMinutes,
                        onChange: (value) =>
                          setFilters((current) => ({
                            ...current,
                            workMinutes: value,
                          })),
                      }}
                      header="근무 시간"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <TableHeaderFilterButton
                      control={{
                        kind: "text",
                        label: "상태",
                        placeholder: "상태로 찾아요",
                        value: filters.status,
                        onChange: (value) =>
                          setFilters((current) => ({
                            ...current,
                            status: value,
                          })),
                      }}
                      header="상태"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-sm text-muted-foreground"
                      colSpan={7}
                    >
                      조건에 맞는 근태 이력이 없어요. 열 제목 필터를 지우면 다른
                      기록을 바로 확인할 수 있어요.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRecords.map((record) => {
                    const status = getHistoryStatusChips(record);
                    const rowToneClass = getRowToneClass(record);

                    return (
                      <TableRow
                        key={`${record.date}-${record.employee.id}`}
                        className={cn(rowToneClass)}
                      >
                        <TableCell className="font-medium text-foreground tabular-nums">
                          {record.date}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {record.employee.name}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {getExpectedWindowLabel(record)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                          {formatLedgerTimeLabel(
                            record.record?.clockInAt ?? null,
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                          {formatLedgerTimeLabel(
                            record.record?.clockOutAt ?? null,
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                          {formatLedgerMinutesLabel(
                            record.record?.workMinutes ?? null,
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              {status.chips.map((chip) => (
                                <StatusChip
                                  key={`${record.date}-${record.employee.id}-${chip.label}`}
                                  className={chip.className}
                                  label={chip.label}
                                />
                              ))}
                            </div>
                            <span className="text-xs leading-5 text-secondary">
                              {getHistorySummaryLabel(record)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>최근 {visibleRecords.length}건을 표시하고 있어요</span>
          <span>{getDateRangeLabel(from, to)}</span>
        </CardFooter>
      </Card>
    </div>
  );
}
