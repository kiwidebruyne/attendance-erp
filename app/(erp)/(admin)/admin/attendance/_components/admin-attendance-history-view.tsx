"use client";

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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

import { formatMinutesLabel, formatTimeLabel } from "../_lib/formatting";

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

type HistorySummary = Readonly<{
  absentCount: number;
  correctionNeededCount: number;
  earlyLeaveCount: number;
  exceptionalCount: number;
  lateCount: number;
  leaveCoverageCount: number;
  nonWorkdayCount: number;
  totalCount: number;
}>;

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

function buildHistorySummary(records: HistoryRecord[]): HistorySummary {
  return records.reduce<HistorySummary>(
    (summary, record) => {
      const status = getHistoryStatusChips(record);

      return {
        absentCount:
          summary.absentCount +
          (status.chips.some((chip) => chip.label === "결근") ? 1 : 0),
        correctionNeededCount:
          summary.correctionNeededCount +
          (status.chips.some((chip) => chip.label === "정정 필요") ? 1 : 0),
        earlyLeaveCount:
          summary.earlyLeaveCount +
          (status.chips.some((chip) => chip.label === "조퇴") ? 1 : 0),
        exceptionalCount:
          summary.exceptionalCount +
          (status.hasDangerousException || status.hasWarningFlag ? 1 : 0),
        lateCount:
          summary.lateCount +
          (status.chips.some((chip) => chip.label === "지각") ? 1 : 0),
        leaveCoverageCount:
          summary.leaveCoverageCount +
          (record.expectedWorkday.leaveCoverage !== null ? 1 : 0),
        nonWorkdayCount:
          summary.nonWorkdayCount + (record.expectedWorkday.isWorkday ? 0 : 1),
        totalCount: summary.totalCount + 1,
      };
    },
    {
      absentCount: 0,
      correctionNeededCount: 0,
      earlyLeaveCount: 0,
      exceptionalCount: 0,
      lateCount: 0,
      leaveCoverageCount: 0,
      nonWorkdayCount: 0,
      totalCount: 0,
    },
  );
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

function MetricTile({
  className,
  label,
  value,
}: Readonly<{
  className?: string;
  label: string;
  value: string;
}>) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-border bg-surface-subtle/60 p-4",
        className,
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function getNameFilterLabel(name?: string) {
  return name === undefined || name.trim().length === 0 ? "전체" : name.trim();
}

function formatLedgerTimeLabel(value: string | null) {
  return value === null ? "-" : formatTimeLabel(value);
}

function formatLedgerMinutesLabel(value: number | null) {
  return value === null ? "-" : formatMinutesLabel(value);
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
  const records = [...response.records].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const summary = buildHistorySummary(records);
  const nameFilterLabel = getNameFilterLabel(name);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>근태 이력을 한눈에 보고 있어요</CardTitle>
            <CardDescription>
              이름과 날짜 범위를 좁히면 필요한 기록만 빠르게 비교할 수 있어요
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                className="border-border bg-white text-secondary"
                variant="outline"
              >
                기간 {from} ~ {to}
              </Badge>
              <Badge
                className="border-border bg-white text-secondary"
                variant="outline"
              >
                이름 {nameFilterLabel}
              </Badge>
              <Badge
                className="border-status-danger/20 bg-status-danger-soft text-status-danger"
                variant="ghost"
              >
                확인 필요 {summary.exceptionalCount}건
              </Badge>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="표시된 기록"
                value={`${summary.totalCount}건`}
              />
              <MetricTile
                label="정정 필요"
                value={`${summary.correctionNeededCount}건`}
              />
              <MetricTile label="지각" value={`${summary.lateCount}건`} />
              <MetricTile
                label="조퇴·결근"
                value={`${summary.earlyLeaveCount + summary.absentCount}건`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>운영 요약</CardTitle>
            <CardDescription>
              현재 목록에서 눈에 띄는 상태만 모았어요
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricTile
              className="bg-primary/5"
              label="운영 확인"
              value={`${summary.exceptionalCount}건`}
            />
            <MetricTile
              label="휴가 반영"
              value={`${summary.leaveCoverageCount}건`}
            />
            <MetricTile label="휴일" value={`${summary.nonWorkdayCount}건`} />
            <MetricTile
              label="조퇴 또는 결근"
              value={`${summary.earlyLeaveCount + summary.absentCount}건`}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>필터</CardTitle>
            <CardDescription>
              이름과 날짜 범위를 바꿔서 이력을 좁혀요
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label
              className="flex flex-col gap-2 text-sm font-medium text-foreground"
              htmlFor="admin-attendance-history-name"
            >
              이름
              <Input
                autoComplete="off"
                id="admin-attendance-history-name"
                name="name"
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="이름으로 찾아요…"
                type="search"
                value={name ?? ""}
              />
            </label>

            <Separator />

            <div className="grid gap-4">
              <label
                className="flex flex-col gap-2 text-sm font-medium text-foreground"
                htmlFor="admin-attendance-history-from"
              >
                시작일
                <Input
                  autoComplete="off"
                  id="admin-attendance-history-from"
                  name="from"
                  onChange={(event) => onFromChange(event.target.value)}
                  type="date"
                  value={from}
                />
              </label>

              <label
                className="flex flex-col gap-2 text-sm font-medium text-foreground"
                htmlFor="admin-attendance-history-to"
              >
                종료일
                <Input
                  autoComplete="off"
                  id="admin-attendance-history-to"
                  name="to"
                  onChange={(event) => onToChange(event.target.value)}
                  type="date"
                  value={to}
                />
              </label>
            </div>

            <div className="rounded-[14px] border border-border bg-surface-subtle/60 p-4">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                현재 조건
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {from} ~ {to}
              </p>
              <p className="mt-1 text-sm leading-6 text-secondary">
                {summary.totalCount}건 중 확인이 필요한 근태는{" "}
                {summary.exceptionalCount}건이에요
              </p>
            </div>
          </CardContent>
        </Card>

        {records.length === 0 ? (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyTitle>
                조건에 맞는 근태 이력이 없어요
                <span className="sr-only">.</span>
              </EmptyTitle>
              <EmptyDescription>
                이름이나 날짜 범위를 바꾸면 다른 기록을 바로 확인할 수 있어요
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>근태 이력</CardTitle>
                  <CardDescription>
                    최신 기록부터 보고 필요한 날짜만 다시 살펴봐요
                  </CardDescription>
                </div>
                <Badge
                  className="border-border bg-white text-secondary"
                  variant="outline"
                >
                  {summary.totalCount}건
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>기준 시간</TableHead>
                      <TableHead>출근</TableHead>
                      <TableHead>퇴근</TableHead>
                      <TableHead>근무 시간</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
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
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">
                                {record.employee.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {record.employee.department}
                              </span>
                            </div>
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
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>최근 {summary.totalCount}건을 표시하고 있어요</span>
              <span>
                {response.from} ~ {response.to}
              </span>
            </CardFooter>
          </Card>
        )}
      </section>
    </div>
  );
}
