import {
  CalendarClockIcon,
  CircleAlertIcon,
  Clock3Icon,
  FileWarningIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AttendanceSharedSheet } from "@/app/(erp)/(employee)/attendance/_components/attendance-shared-sheet";
import {
  formatAttendancePhase,
  formatAttendanceTime,
  formatWorkMinutes,
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

type AttendanceHistoryRecord = AttendancePageData["history"]["records"][number];

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

  return `${hours}시간 ${minutes.toString().padStart(2, "0")}분`;
}

function formatBeaconAuthLabel(today: AttendancePageData["today"]) {
  if (
    today.todayRecord?.clockInSource === "beacon" ||
    today.todayRecord?.clockOutSource === "beacon"
  ) {
    return "인증됨";
  }

  if (
    today.attempts.findLast(
      (attempt) =>
        attempt.status === "failed" &&
        attempt.failureReason.toLowerCase().includes("beacon"),
    ) !== undefined
  ) {
    return "인증 실패";
  }

  if (
    today.todayRecord?.clockInSource === "manual" ||
    today.todayRecord?.clockOutSource === "manual"
  ) {
    return "수동 반영";
  }

  if (today.todayRecord === null) {
    return "-";
  }

  return "-";
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

function getTodayWorkedTimeLabel(
  today: AttendancePageData["today"],
  now: string | null,
) {
  const clockInAt = today.todayRecord?.clockInAt;

  if (clockInAt === null || clockInAt === undefined) {
    return "-";
  }

  const endAt = today.todayRecord?.clockOutAt ?? now;

  if (endAt === null) {
    return "-";
  }

  const workMinutes = getWorkedMinutesBetween(clockInAt, endAt);

  if (workMinutes === null) {
    return "-";
  }

  return formatWorkMinutes(workMinutes);
}

function getLeaveUsageLabel(record: AttendanceHistoryRecord) {
  switch (record.expectedWorkday.leaveCoverage?.leaveType) {
    case "annual":
      return "연차";
    case "half_am":
    case "half_pm":
      return "반차";
    case "hourly":
      return "시간차";
    default:
      return "-";
  }
}

function getHistorySpecialNoteLabel(
  record: AttendanceHistoryRecord,
  todayDate: string,
) {
  if (!record.expectedWorkday.isWorkday) {
    return "휴일";
  }

  if (
    record.date < todayDate &&
    record.record?.clockInAt !== null &&
    record.record?.clockInAt !== undefined &&
    record.record.clockOutAt === null
  ) {
    return "퇴근 누락";
  }

  return "-";
}

function getHistoryStatusChips(
  record: AttendanceHistoryRecord,
  todayDate: string,
): StatusPresentation[] {
  const statuses: StatusPresentation[] = [];
  const hasPendingManualRequest =
    record.manualRequest !== null && record.manualRequest.status === "pending";

  if (hasPendingManualRequest) {
    statuses.push({
      chipClassName: "bg-status-warning-soft text-status-warning",
      label: "정정 요청됨",
    });
  }

  if (
    (!hasPendingManualRequest &&
      record.display.activeExceptions.includes("attempt_failed")) ||
    (!hasPendingManualRequest &&
      record.display.activeExceptions.includes("not_checked_in")) ||
    record.display.activeExceptions.includes("manual_request_rejected") ||
    (!hasPendingManualRequest &&
      record.date < todayDate &&
      record.record?.clockInAt !== null &&
      record.record?.clockInAt !== undefined &&
      record.record.clockOutAt === null)
  ) {
    statuses.push({
      chipClassName: "bg-status-danger-soft text-status-danger",
      label: "정정 필요",
    });
  }

  if (record.display.activeExceptions.includes("absent")) {
    statuses.push({
      chipClassName: "bg-status-danger-soft text-status-danger",
      label: "결근",
    });
  }

  if (record.display.flags.includes("late")) {
    statuses.push({
      chipClassName: "bg-status-warning-soft text-status-warning",
      label: "지각",
    });
  }

  if (record.display.flags.includes("early_leave")) {
    statuses.push({
      chipClassName: "bg-status-warning-soft text-status-warning",
      label: "조퇴",
    });
  }

  if (statuses.length === 0) {
    if (!record.expectedWorkday.isWorkday || record.record === null) {
      return [];
    }

    statuses.push({
      chipClassName: "bg-status-success-soft text-status-success",
      label: "정상",
    });
  }

  const seen = new Set<string>();

  return statuses.filter((status) => {
    if (seen.has(status.label)) {
      return false;
    }

    seen.add(status.label);
    return true;
  });
}

function getHistoryIssueLabels(
  record: AttendanceHistoryRecord,
  todayDate: string,
) {
  const specialNote = getHistorySpecialNoteLabel(record, todayDate);
  const statuses = getHistoryStatusChips(record, todayDate);
  const labels = [
    specialNote === "-" || specialNote === "휴일" ? null : specialNote,
    ...statuses
      .map((status) => status.label)
      .filter((label) => label !== "정상"),
  ].filter((label): label is string => label !== null);

  return [...new Set(labels)];
}

function hasHistoryIssue(record: AttendanceHistoryRecord, todayDate: string) {
  return getHistoryIssueLabels(record, todayDate).length > 0;
}

function hasCorrectionNeededStatus(
  record: AttendanceHistoryRecord,
  todayDate: string,
) {
  return getHistoryStatusChips(record, todayDate).some(
    (status) => status.label === "정정 필요",
  );
}

function hasPendingRequestStatus(
  record: AttendanceHistoryRecord,
  todayDate: string,
) {
  return getHistoryStatusChips(record, todayDate).some(
    (status) => status.label === "정정 요청됨",
  );
}

function hasEscalatedHistoryStatus(
  record: AttendanceHistoryRecord,
  todayDate: string,
) {
  return getHistoryStatusChips(record, todayDate).some(
    (status) => status.label === "정정 필요" || status.label === "결근",
  );
}

function getHistoricalIssueDescription(issueLabels: string[]) {
  if (issueLabels.length === 1) {
    return `${issueLabels[0]} 상태가 보여서 이 날짜 기록을 열어서 정정할 수 있어요`;
  }

  return `${issueLabels.join(", ")} 항목이 함께 보여서 이 날짜 기록을 열어서 정정할 수 있어요`;
}

function deduplicateRailSurfaces(surfaces: AttendanceSurfaceModel[]) {
  const preferredRequestSurfaceByTargetDate = new Map<
    string,
    AttendanceSurfaceModel
  >();

  for (const surface of surfaces) {
    if (
      surface.railTargetDate === null ||
      surface.railTargetKind !== "request" ||
      preferredRequestSurfaceByTargetDate.has(surface.railTargetDate)
    ) {
      continue;
    }

    preferredRequestSurfaceByTargetDate.set(surface.railTargetDate, surface);
  }

  return surfaces.filter((surface) => {
    if (
      surface.railTargetDate === null ||
      surface.railTargetKind === "independent"
    ) {
      return true;
    }

    const preferredRequestSurface = preferredRequestSurfaceByTargetDate.get(
      surface.railTargetDate,
    );

    if (preferredRequestSurface === undefined) {
      return true;
    }

    return preferredRequestSurface === surface;
  });
}

function buildHistoricalIssueSurfaces(
  data: AttendancePageData,
): AttendanceSurfaceModel[] {
  const sortedRecords = [...data.history.records].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const destructiveSurfaces = sortedRecords
    .filter(
      (record) =>
        record.date < data.date &&
        hasHistoryIssue(record, data.date) &&
        hasEscalatedHistoryStatus(record, data.date) &&
        !hasPendingRequestStatus(record, data.date),
    )
    .flatMap((record) => {
      const historyAction = buildHistoryAction(record);

      if (historyAction === null) {
        return [];
      }

      return [
        {
          ...historyAction,
          id: `history-issue-${record.date}`,
          title: formatNumericDateLabel(record.date),
          description: getHistoricalIssueDescription(
            getHistoryIssueLabels(record, data.date),
          ),
          tone: "destructive" as const,
        },
      ];
    });
  const pendingSurfaces = sortedRecords
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter(
      (record) =>
        record.date < data.date && hasPendingRequestStatus(record, data.date),
    )
    .flatMap((record) => {
      const historyAction = buildHistoryAction(record);

      if (historyAction === null) {
        return [];
      }

      return [
        {
          ...historyAction,
          id: `history-request-${record.date}`,
          title: "정정 요청중이에요",
          description: "제출한 정정 요청 내용을 다시 확인할 수 있어요",
          tone: "warning" as const,
        },
      ];
    });

  return [...destructiveSurfaces, ...pendingSurfaces];
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
  iconClassName: string;
}> {
  if (surface.id === "leave-work-conflict") {
    return {
      icon: CircleAlertIcon,
      iconClassName: "text-status-info",
      titleClassName: "text-status-info",
    };
  }

  if (surface.id.startsWith("attempt-failed")) {
    return {
      icon: FileWarningIcon,
      iconClassName: "text-status-warning",
      titleClassName: "text-status-warning",
    };
  }

  if (surface.tone === "warning") {
    return {
      icon: CircleAlertIcon,
      iconClassName: "text-status-warning",
      titleClassName: "text-status-warning",
    };
  }

  return {
    icon:
      surface.tone === "destructive" ? TriangleAlertIcon : CalendarClockIcon,
    iconClassName:
      surface.tone === "destructive" ? "text-status-danger" : "text-foreground",
    titleClassName:
      surface.tone === "destructive" ? "text-status-danger" : "text-foreground",
  };
}

function getSurfaceButtonVariant(surface: AttendanceSurfaceModel) {
  if (surface.tone === "destructive") {
    return "destructive";
  }

  if (surface.tone === "warning") {
    return "outline";
  }

  if (surface.kind === "leave_conflict") {
    return "outline";
  }

  if (surface.kind === "pending") {
    return "outline";
  }

  return "secondary";
}

function getSurfaceCardClassName(surface: AttendanceSurfaceModel) {
  if (surface.tone === "warning") {
    return "border-status-warning/30 bg-status-warning-soft/18";
  }

  return undefined;
}

function getTotalWorkTimeLabel(
  record: AttendancePageData["history"]["records"][number],
) {
  if (
    record.record?.workMinutes === null ||
    record.record?.workMinutes === undefined
  ) {
    return "-";
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

function TodayBriefingPanel({ data }: Pick<AttendancePageScreenProps, "data">) {
  const [now, setNow] = useState<string | null>(null);
  const weeklyMinutes = getWeeklyWorkMinutes(data);

  useEffect(() => {
    const syncNow = () => {
      setNow(new Date().toISOString());
    };

    syncNow();

    const intervalId = window.setInterval(() => {
      syncNow();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
      <Card>
        <CardContent className="flex h-full flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex flex-1 flex-col gap-5 xl:flex-row xl:items-center xl:gap-8">
            <div className="min-w-[184px] space-y-2">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                현재 근무 상태
              </p>
              <div className="flex items-center">
                <p className="text-[30px] font-semibold tracking-[-0.03em] text-[#162847]">
                  {formatAttendancePhase(data.today.display.phase)}
                </p>
              </div>
            </div>

            <div className="hidden h-10 w-px bg-border xl:block" />

            <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  출근 시간
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {formatAttendanceTime(
                    data.today.todayRecord?.clockInAt ?? null,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  퇴근 시간
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {formatAttendanceTime(
                    data.today.todayRecord?.clockOutAt ?? null,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  비콘 인증 여부
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                  {formatBeaconAuthLabel(data.today)}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  오늘 근무한 시간
                </p>
                <p className="text-[20px] font-bold tracking-[-0.02em] text-primary tabular-nums">
                  {getTodayWorkedTimeLabel(data.today, now)}
                </p>
              </div>
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
          <p className="text-[32px] font-bold tracking-[-0.04em] text-white tabular-nums">
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
  const todaySurfaces = buildExceptionSurfaceModels(data.today);
  const historicalSurfaces = buildHistoricalIssueSurfaces(data);
  const surfaces = deduplicateRailSurfaces([
    ...todaySurfaces.filter((surface) => surface.tone !== "warning"),
    ...historicalSurfaces.filter((surface) => surface.tone !== "warning"),
    ...todaySurfaces.filter((surface) => surface.tone === "warning"),
    ...historicalSurfaces.filter((surface) => surface.tone === "warning"),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-4 text-status-danger"
        />
        <h2 className="text-sm font-medium text-foreground text-balance">
          지금 확인할 예외가 있어요
        </h2>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-status-danger-soft text-[10px] font-medium text-status-danger">
          {surfaces.length}
        </span>
      </div>

      {surfaces.length === 0 ? (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              지금 바로 확인할 예외가 없어요
            </p>
            <p className="text-sm leading-6 text-secondary">
              새로운 문제나 검토 결과가 생기면 이 영역에서 먼저 보여드려요
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {surfaces.map((surface) => {
            const presentation = getSurfacePresentation(surface);
            const metaLabel = getSurfaceMetaLabel(surface, data);

            return (
              <Card
                key={surface.id}
                className={getSurfaceCardClassName(surface)}
              >
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <presentation.icon
                        aria-hidden="true"
                        className={cn("size-4", presentation.iconClassName)}
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
                    variant={getSurfaceButtonVariant(surface)}
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
      className="ml-auto"
      onClick={() => onOpenSheet(historyAction)}
      size="sm"
      variant={historyAction.tone === "warning" ? "outline" : "secondary"}
    >
      {historyAction.label}
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
  const records = [...data.history.records].sort((left, right) =>
    right.date.localeCompare(left.date),
  );

  return (
    <Card className="scroll-mt-20" id="history-ledger">
      <div className="flex flex-col gap-4 border-b border-border/80 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-[-0.03em] text-balance text-foreground">
            출퇴근 이력
          </h2>
          <p className="text-sm leading-6 text-secondary">
            최근 {data.view === "week" ? "7일" : "30일"} 기록을 보고 필요한
            날짜만 다시 열어 확인해요
          </p>
        </div>
        <ToggleGroup
          className="rounded-[8px] border border-border/80 bg-muted/75 p-1"
          disabled={isSubmitting}
          spacing={1}
          type="single"
          value={data.view}
          onValueChange={(value) => {
            if (value === "" || value === data.view) {
              return;
            }

            onViewChange(value as AttendanceHistoryView);
          }}
        >
          <ToggleGroupItem className="rounded-[8px]" value="week">
            7일
          </ToggleGroupItem>
          <ToggleGroupItem className="rounded-[8px]" value="month">
            30일
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>특이사항</TableHead>
            <TableHead>휴가 사용</TableHead>
            <TableHead>출근 시간</TableHead>
            <TableHead>퇴근 시간</TableHead>
            <TableHead>총 근무 시간</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const historyAction = buildHistoryAction(record);
            const specialNote = getHistorySpecialNoteLabel(record, data.date);
            const leaveUsage = getLeaveUsageLabel(record);
            const statuses = getHistoryStatusChips(record, data.date);
            const hasPendingRequestRow = hasPendingRequestStatus(
              record,
              data.date,
            );
            const hasCorrectionNeededRow = hasCorrectionNeededStatus(
              record,
              data.date,
            );
            const hasAbsentRow = getHistoryStatusChips(record, data.date).some(
              (status) => status.label === "결근",
            );

            return (
              <TableRow
                key={record.date}
                className={cn(
                  hasPendingRequestRow &&
                    "bg-status-warning-soft/42 hover:bg-status-warning-soft/56",
                  !hasPendingRequestRow &&
                    (hasCorrectionNeededRow || hasAbsentRow) &&
                    "bg-status-danger-soft/42 hover:bg-status-danger-soft/56",
                )}
              >
                <TableCell className="font-medium text-foreground tabular-nums">
                  {formatNumericDateLabel(record.date)}
                </TableCell>
                <TableCell className="text-foreground">{specialNote}</TableCell>
                <TableCell className="text-foreground">{leaveUsage}</TableCell>
                <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                  {formatAttendanceTime(record.record?.clockInAt ?? null)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                  {formatAttendanceTime(record.record?.clockOutAt ?? null)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                  {getTotalWorkTimeLabel(record)}
                </TableCell>
                <TableCell>
                  {statuses.length === 0 ? (
                    <span className="text-sm text-muted-foreground">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {statuses.map((status) => (
                        <StatusChip
                          key={`${record.date}-${status.label}`}
                          className={status.chipClassName}
                          label={status.label}
                        />
                      ))}
                    </div>
                  )}
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
        <span>최근 {data.history.records.length}건을 표시하고 있어요</span>
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
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          근태 관리
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          오늘의 근무 상태와 기록을 확인하고 관리합니다
        </p>
      </header>

      <TodayBriefingPanel data={data} />

      <section className="grid gap-8 xl:items-start xl:grid-cols-[317px_minmax(0,1fr)]">
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
