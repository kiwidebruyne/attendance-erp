import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  Clock3Icon,
  FileWarningIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { AttendanceSharedSheet } from "@/app/(erp)/(employee)/attendance/_components/attendance-shared-sheet";
import {
  formatAttendanceException,
  formatAttendanceFlag,
  formatAttendancePhase,
  formatAttendanceTime,
  formatNextAction,
  formatWorkMinutes,
  formatWorkWindow,
} from "@/app/(erp)/(employee)/attendance/_lib/format";
import type { AttendanceManualRequestDraft } from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import {
  type AttendanceHistoryAction,
  type AttendanceSheetState,
  type AttendanceSurfaceModel,
  buildExceptionSurfaceModels,
  buildHistoryAction,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  AttendanceHistoryView,
  AttendancePageData,
} from "@/lib/attendance/page-data";
import type { AttendanceDisplay } from "@/lib/contracts/shared";
import { cn } from "@/lib/utils";

type AttendancePageScreenProps = {
  data: AttendancePageData;
  isSubmitting: boolean;
  mutationError: string | null;
  onCloseSheet: () => void;
  onEditPendingRequest: () => void;
  onOpenSheet: (surface: AttendanceSurfaceModel) => void;
  onResubmitRequest: () => void;
  onSubmit: (draft: AttendanceManualRequestDraft) => void;
  onViewChange: (view: AttendanceHistoryView) => void;
  onWithdrawPendingRequest: () => void;
  sheetState: AttendanceSheetState | null;
};

type StatusPresentation = Readonly<{
  chipClassName: string;
  label: string;
}>;

const numericDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  weekday: "short",
});

const meridiemTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatNumericDateLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00+09:00`);
  const numericDate = numericDateFormatter
    .format(parsedDate)
    .replaceAll(" ", "")
    .replaceAll(". ", ".")
    .replace(/\.$/, "");

  return `${numericDate} (${weekdayFormatter.format(parsedDate)})`;
}

function formatSurfaceTimeLabel(isoDateTime: string) {
  return meridiemTimeFormatter
    .format(new Date(isoDateTime))
    .replace(" ", " ")
    .replace(".", "");
}

function formatWeeklyMinutes(workMinutes: number) {
  const hours = Math.floor(workMinutes / 60);
  const minutes = workMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function addDays(date: string, delta: number) {
  const cursor = new Date(`${date}T00:00:00Z`);

  cursor.setUTCDate(cursor.getUTCDate() + delta);

  return cursor.toISOString().slice(0, 10);
}

function getWeeklyWorkMinutes(data: AttendancePageData) {
  const weekStart = addDays(data.date, -6);

  return data.history.records.reduce((total, record) => {
    if (record.date < weekStart || record.date > data.date) {
      return total;
    }

    return total + (record.record?.workMinutes ?? 0);
  }, 0);
}

function getTodayStatusPresentation(
  data: AttendancePageData,
): StatusPresentation {
  const [firstException] = data.today.display.activeExceptions;
  const [firstFlag] = data.today.display.flags;

  if (firstException === "manual_request_pending") {
    return {
      chipClassName: "bg-status-info-soft text-status-info",
      label: "검토 중",
    };
  }

  if (firstException === "leave_work_conflict") {
    return {
      chipClassName: "bg-status-info-soft text-status-info",
      label: "충돌 확인",
    };
  }

  if (
    firstException === "attempt_failed" ||
    firstFlag === "late" ||
    firstFlag === "early_leave"
  ) {
    return {
      chipClassName: "bg-status-warning-soft text-status-warning",
      label:
        firstException === "attempt_failed"
          ? "시도 실패"
          : formatAttendanceFlag(firstFlag),
    };
  }

  if (firstException !== undefined) {
    return {
      chipClassName: "bg-status-danger-soft text-status-danger",
      label: formatAttendanceException(
        firstException,
        data.today.manualRequest,
      ),
    };
  }

  if (data.today.display.phase === "working") {
    return {
      chipClassName: "bg-status-success-soft text-status-success",
      label: "정상 근무",
    };
  }

  return {
    chipClassName: "bg-surface-subtle text-secondary",
    label: formatAttendancePhase(data.today.display.phase),
  };
}

function getHistoryStatusPresentation(
  display: AttendanceDisplay,
  request: AttendancePageData["today"]["manualRequest"],
): StatusPresentation {
  const [firstException] = display.activeExceptions;
  const [firstFlag] = display.flags;

  if (firstException === "manual_request_pending") {
    return {
      chipClassName: "bg-status-info-soft text-status-info",
      label: "정정 요청",
    };
  }

  if (firstException === "leave_work_conflict") {
    return {
      chipClassName: "bg-status-info-soft text-status-info",
      label: "휴가 충돌",
    };
  }

  if (firstException === "attempt_failed") {
    return {
      chipClassName: "bg-status-warning-soft text-status-warning",
      label: "시도 실패",
    };
  }

  if (firstFlag === "late" || firstFlag === "early_leave") {
    return {
      chipClassName: "bg-status-warning-soft text-status-warning",
      label: formatAttendanceFlag(firstFlag),
    };
  }

  if (firstException !== undefined) {
    return {
      chipClassName: "bg-status-danger-soft text-status-danger",
      label: formatAttendanceException(firstException, request),
    };
  }

  return {
    chipClassName: "bg-status-success-soft text-status-success",
    label: "정상",
  };
}

function getSurfaceMetaLabel(
  surface: AttendanceSurfaceModel,
  data: AttendancePageData,
) {
  if (surface.id === "previous-day-checkout-missing") {
    return data.today.previousDayOpenRecord === null
      ? null
      : formatNumericDateLabel(data.today.previousDayOpenRecord.date);
  }

  if (surface.id.startsWith("attempt-failed")) {
    const failedAttempt = data.today.attempts.findLast(
      (attempt) => attempt.status === "failed",
    );

    return failedAttempt === undefined
      ? null
      : formatSurfaceTimeLabel(failedAttempt.attemptedAt);
  }

  if (
    surface.id === "manual-request-summary" &&
    data.today.manualRequest !== null &&
    data.today.manualRequest.reviewedAt !== null
  ) {
    return formatNumericDateLabel(data.today.manualRequest.date);
  }

  if (surface.id === "leave-work-conflict") {
    return formatNumericDateLabel(data.today.date);
  }

  return null;
}

function getSurfacePresentation(surface: AttendanceSurfaceModel): Readonly<{
  icon: typeof TriangleAlertIcon;
  titleClassName: string;
}> {
  if (surface.id === "leave-work-conflict") {
    return {
      icon: CircleAlertIcon,
      titleClassName: "text-status-info",
    };
  }

  if (surface.id.startsWith("attempt-failed")) {
    return {
      icon: FileWarningIcon,
      titleClassName: "text-status-warning",
    };
  }

  return {
    icon:
      surface.tone === "destructive" ? TriangleAlertIcon : CalendarClockIcon,
    titleClassName:
      surface.tone === "destructive" ? "text-status-danger" : "text-foreground",
  };
}

function getTodayPrimaryAction(surfaces: AttendanceSurfaceModel[]): Readonly<{
  href?: string;
  label: string;
  surface: AttendanceSurfaceModel | null;
}> {
  if (surfaces.length > 0) {
    return {
      label: `우선 확인: ${surfaces[0].ctaLabel}`,
      surface: surfaces[0],
    };
  }

  return {
    href: "#history-ledger",
    label: "출퇴근 이력 보기",
    surface: null,
  };
}

function getActualRecordSummary(
  record: AttendancePageData["history"]["records"][number],
) {
  return `${formatAttendanceTime(record.record?.clockInAt ?? null)} - ${formatAttendanceTime(record.record?.clockOutAt ?? null)}`;
}

function getWorkMinutesDetail(
  record: AttendancePageData["history"]["records"][number],
) {
  if (
    record.record?.workMinutes === null ||
    record.record?.workMinutes === undefined
  ) {
    return null;
  }

  return formatWorkMinutes(record.record.workMinutes);
}

function StatusChip({
  className,
  label,
}: Readonly<{
  className: string;
  label: string;
}>) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium",
        className,
      )}
    >
      {label}
    </span>
  );
}

function TodayBriefingPanel({
  data,
  onOpenSheet,
}: Pick<AttendancePageScreenProps, "data" | "onOpenSheet">) {
  const surfaces = buildExceptionSurfaceModels(data.today);
  const weeklyMinutes = getWeeklyWorkMinutes(data);
  const status = getTodayStatusPresentation(data);
  const primaryAction = getTodayPrimaryAction(surfaces);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
      <Card>
        <CardContent className="flex h-full flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-5 xl:flex-row xl:items-center xl:gap-8">
            <div className="min-w-[184px] space-y-2">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                현재 근무 상태
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    status.label === "정상 근무"
                      ? "bg-status-success"
                      : status.label === "검토 중" ||
                          status.label === "충돌 확인"
                        ? "bg-status-info"
                        : status.label === "시도 실패" ||
                            status.label === "지각"
                          ? "bg-status-warning"
                          : "bg-status-danger",
                  )}
                />
                <p className="text-[28px] font-medium tracking-[-0.03em] text-[#162847]">
                  {formatAttendancePhase(data.today.display.phase)}
                </p>
                <StatusChip
                  className={status.chipClassName}
                  label={status.label}
                />
              </div>
              <p className="text-sm leading-6 text-secondary">
                {formatNextAction(data.today.display)}
              </p>
            </div>

            <div className="hidden h-10 w-px bg-border xl:block" />

            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  출근 시간
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                  {formatAttendanceTime(
                    data.today.todayRecord?.clockInAt ?? null,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  예상 퇴근
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                  {formatAttendanceTime(
                    data.today.expectedWorkday.adjustedClockOutAt ??
                      data.today.expectedWorkday.expectedClockOutAt,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  누적 근무 시간
                </p>
                <p className="text-[20px] font-bold tracking-[-0.02em] text-primary">
                  {formatWorkMinutes(
                    data.today.todayRecord?.workMinutes ?? null,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[176px] xl:items-end">
            {primaryAction.surface === null ? (
              <Button asChild className="w-full xl:w-auto">
                <a href={primaryAction.href}>{primaryAction.label}</a>
              </Button>
            ) : (
              <Button
                className="w-full xl:w-auto"
                onClick={() => onOpenSheet(primaryAction.surface)}
              >
                {primaryAction.label}
              </Button>
            )}

            <div className="flex flex-wrap gap-2 xl:max-w-[260px] xl:justify-end">
              {data.today.display.activeExceptions.map((exception) => (
                <StatusChip
                  key={exception}
                  className="border border-border bg-white text-secondary"
                  label={formatAttendanceException(
                    exception,
                    data.today.manualRequest,
                  )}
                />
              ))}
              {data.today.display.flags.map((flag) => (
                <StatusChip
                  key={flag}
                  className="border border-border bg-white text-secondary"
                  label={formatAttendanceFlag(flag)}
                />
              ))}
              {data.today.display.activeExceptions.length === 0 &&
              data.today.display.flags.length === 0 ? (
                <StatusChip
                  className="border border-border bg-white text-secondary"
                  label="정상 흐름"
                />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex min-h-[145px] flex-col justify-between rounded-[16px] bg-primary p-6 text-white shadow-[0_12px_24px_rgba(79,70,229,0.24)]">
        <div className="flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/12">
            <Clock3Icon aria-hidden="true" className="size-4" />
          </div>
          <StatusChip className="bg-white/10 text-white" label="주간 통계" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-white/70">이번 주 누적</p>
          <p className="text-[32px] font-bold tracking-[-0.04em] text-white">
            {formatWeeklyMinutes(weeklyMinutes)}
          </p>
        </div>
      </div>
    </section>
  );
}

function ExceptionStack({
  data,
  onOpenSheet,
}: Pick<AttendancePageScreenProps, "data" | "onOpenSheet">) {
  const surfaces = buildExceptionSurfaceModels(data.today);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-4 text-status-danger"
        />
        <h2 className="text-sm font-medium text-foreground">예외 사항 처리</h2>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-status-danger-soft text-[10px] font-medium text-status-danger">
          {surfaces.length}
        </span>
      </div>

      {surfaces.length === 0 ? (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              지금 바로 확인할 예외가 없어요.
            </p>
            <p className="text-sm leading-6 text-secondary">
              새로운 문제나 검토 결과가 생기면 이 영역에서 먼저 보여드려요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {surfaces.map((surface) => {
            const presentation = getSurfacePresentation(surface);
            const metaLabel = getSurfaceMetaLabel(surface, data);

            return (
              <Card key={surface.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <presentation.icon
                        aria-hidden="true"
                        className={cn(
                          "size-4",
                          surface.id === "leave-work-conflict"
                            ? "text-status-info"
                            : surface.id.startsWith("attempt-failed")
                              ? "text-status-warning"
                              : "text-status-danger",
                        )}
                      />
                      <p
                        className={cn(
                          "text-[13px] font-medium leading-5",
                          presentation.titleClassName,
                        )}
                      >
                        {surface.title}
                      </p>
                    </div>
                    {metaLabel === null ? null : (
                      <span className="text-[11px] text-muted-foreground">
                        {metaLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-secondary">
                    {surface.description}
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => onOpenSheet(surface)}
                    variant="outline"
                  >
                    {surface.ctaLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HistoryRowAction({
  historyAction,
  onOpenSheet,
}: Readonly<{
  historyAction: AttendanceHistoryAction | null;
  onOpenSheet: (surface: AttendanceSurfaceModel) => void;
}>) {
  if (historyAction === null) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <Button
      aria-label={historyAction.label}
      onClick={() => onOpenSheet(historyAction)}
      size="icon-xs"
      variant="ghost"
    >
      <ArrowUpRightIcon />
      <span className="sr-only">{historyAction.label}</span>
    </Button>
  );
}

function HistorySection({
  data,
  isSubmitting,
  onOpenSheet,
  onViewChange,
}: Pick<
  AttendancePageScreenProps,
  "data" | "isSubmitting" | "onOpenSheet" | "onViewChange"
>) {
  return (
    <Card className="scroll-mt-20" id="history-ledger">
      <div className="flex flex-col gap-4 border-b border-border/80 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">
            출퇴근 이력
          </h2>
          <p className="text-sm leading-6 text-secondary">
            최근 {data.view === "week" ? "7일" : "30일"} 기록을 보고 필요한
            날짜만 다시 열어 확인해요.
          </p>
        </div>
        <ToggleGroup
          disabled={isSubmitting}
          type="single"
          value={data.view}
          onValueChange={(value) => {
            if (value === "" || value === data.view) {
              return;
            }

            onViewChange(value as AttendanceHistoryView);
          }}
        >
          <ToggleGroupItem value="week">7일</ToggleGroupItem>
          <ToggleGroupItem value="month">30일</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>예정 시간</TableHead>
            <TableHead>실제 기록</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.history.records.map((record) => {
            const historyAction = buildHistoryAction(record);
            const workMinutesDetail = getWorkMinutesDetail(record);
            const status = getHistoryStatusPresentation(
              record.display,
              data.today.manualRequest,
            );

            return (
              <TableRow key={record.date}>
                <TableCell className="font-medium text-foreground">
                  {formatNumericDateLabel(record.date)}
                </TableCell>
                <TableCell>
                  {formatWorkWindow(record.expectedWorkday)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-foreground">
                    <span>{getActualRecordSummary(record)}</span>
                    {workMinutesDetail === null ? null : (
                      <span className="text-xs text-muted-foreground">
                        ({workMinutesDetail})
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusChip
                    className={status.chipClassName}
                    label={status.label}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <HistoryRowAction
                    historyAction={historyAction}
                    onOpenSheet={onOpenSheet}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/80 px-6 py-4 text-[11px] text-muted-foreground">
        <span>최근 {data.history.records.length}건을 표시하고 있어요.</span>
        <span>
          {data.historyRange.from} ~ {data.historyRange.to}
        </span>
      </div>
    </Card>
  );
}

export function AttendancePageScreen({
  data,
  isSubmitting,
  mutationError,
  onCloseSheet,
  onEditPendingRequest,
  onOpenSheet,
  onResubmitRequest,
  onSubmit,
  onViewChange,
  onWithdrawPendingRequest,
  sheetState,
}: AttendancePageScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="space-y-1">
        <h1 className="text-[32px] font-medium tracking-[-0.04em] text-foreground">
          근태 관리
        </h1>
        <p className="text-sm leading-6 text-secondary">
          오늘의 근무 상태와 기록을 확인하고 관리합니다.
        </p>
      </header>

      <TodayBriefingPanel data={data} onOpenSheet={onOpenSheet} />

      <section className="grid gap-8 xl:grid-cols-[317px_minmax(0,1fr)]">
        <ExceptionStack data={data} onOpenSheet={onOpenSheet} />
        <HistorySection
          data={data}
          isSubmitting={isSubmitting}
          onOpenSheet={onOpenSheet}
          onViewChange={onViewChange}
        />
      </section>

      <AttendanceSharedSheet
        errorMessage={mutationError}
        isSubmitting={isSubmitting}
        state={sheetState}
        onClose={onCloseSheet}
        onEditPendingRequest={onEditPendingRequest}
        onResubmitRequest={onResubmitRequest}
        onSubmit={onSubmit}
        onWithdrawPendingRequest={onWithdrawPendingRequest}
      />
    </div>
  );
}
