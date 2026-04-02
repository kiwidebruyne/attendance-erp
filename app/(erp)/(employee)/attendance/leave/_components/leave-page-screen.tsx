import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  FileClockIcon,
  ListTodoIcon,
} from "lucide-react";

import {
  buildDateTimeFromDateAndTime,
  formatHourlyDurationHours,
  formatLeaveDateLabel,
  formatLeaveDateTimeLabel,
  formatLeaveDayCount,
  formatLeaveRequestSummary,
  formatLeaveTypeLabel,
  getLeaveConflictMessages,
  hasMeaningfulLeaveConflict,
} from "@/app/(erp)/(employee)/attendance/leave/_lib/format";
import type { LeavePageData } from "@/app/(erp)/(employee)/attendance/leave/_lib/page-data";
import {
  formatChainMenuLabel,
  type LeaveChainAction,
  type LeaveChainModel,
  type LeaveComposerDraft,
  type LeavePageViewModel,
} from "@/app/(erp)/(employee)/attendance/leave/_lib/view-model";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type LeavePageScreenProps = {
  composerChain: LeaveChainModel | null;
  composerDraft: LeaveComposerDraft | null;
  correctionCandidateId: string | null;
  data: LeavePageData;
  isSubmitting: boolean;
  mutationError: string | null;
  onClearComposer: () => void;
  onComposerFieldChange: (patch: Partial<LeaveComposerDraft>) => void;
  onCorrectionCandidateChange: (rootRequestId: string) => void;
  onMonthChange: (delta: number) => void;
  onOpenNewComposer: () => void;
  onRunChainAction: (action: LeaveChainAction) => void;
  onSelectDate: (date: string) => void;
  onSubmitComposer: () => void;
  viewModel: LeavePageViewModel;
  visibleMonth: string;
};

const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"] as const;

const monthTitleFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
});

function toDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(date: string, delta: number) {
  const cursor = toDate(date);
  cursor.setUTCDate(cursor.getUTCDate() + delta);
  return cursor.toISOString().slice(0, 10);
}

function addMonths(month: string, delta: number) {
  const cursor = toDate(month);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + delta);
  return cursor.toISOString().slice(0, 10);
}

function isWeekendDate(date: string) {
  const day = toDate(date).getUTCDay();
  return day === 0 || day === 6;
}

function formatMonthTitle(month: string) {
  return monthTitleFormatter.format(toDate(month));
}

function listCalendarDates(month: string) {
  const firstDate = toDate(month);
  const monthKey = month.slice(0, 7);
  const firstWeekdayIndex = (firstDate.getUTCDay() + 6) % 7;
  const gridStart = addDays(month, -firstWeekdayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);

    return {
      date,
      dayOfMonth: Number.parseInt(date.slice(-2), 10),
      inMonth: date.slice(0, 7) === monthKey,
    };
  });
}

function getActionButtonVariant(action: LeaveChainAction) {
  return action.kind === "withdraw" || action.kind === "cancel"
    ? "outline"
    : "secondary";
}

function getStatusBadgeVariant(chain: LeaveChainModel) {
  switch (chain.statusTone) {
    case "approved":
      return "secondary";
    case "attention":
      return "destructive";
    case "pending":
      return "default";
    default:
      return "outline";
  }
}

function getCalendarToneClass(chains: readonly LeaveChainModel[]) {
  if (
    chains.some(
      (chain) =>
        chain.activeRequest?.followUpKind === "change" ||
        chain.activeRequest?.followUpKind === "cancel",
    )
  ) {
    return "bg-primary";
  }

  if (chains.some((chain) => chain.topCorrectionEligible)) {
    return "bg-status-danger";
  }

  if (chains.some((chain) => chain.activeRequest !== null)) {
    return "bg-status-warning";
  }

  if (
    chains.some(
      (chain) =>
        chain.activeRequest === null && chain.effectiveRequest.status === "approved",
    )
  ) {
    return "bg-status-success";
  }

  return "bg-muted-foreground/40";
}

function getRelatedChainsByDate(viewModel: LeavePageViewModel) {
  const chainsByDate = new Map<string, LeaveChainModel[]>();

  for (const chain of viewModel.visibleChains) {
    for (const request of chain.requests) {
      const existing = chainsByDate.get(request.date) ?? [];

      if (!existing.some((item) => item.rootRequestId === chain.rootRequestId)) {
        existing.push(chain);
        chainsByDate.set(request.date, existing);
      }
    }
  }

  return chainsByDate;
}

function getSelectionState(data: LeavePageData) {
  if (data.selectedDate < data.baselineDate) {
    return {
      canCreate: false,
      message: "지난 날짜는 새 휴가 요청 대신 이력 확인이 필요해요",
    };
  }

  if (isWeekendDate(data.selectedDate)) {
    return {
      canCreate: false,
      message: "휴일은 새 휴가 요청 대상이 아니에요",
    };
  }

  return {
    canCreate: true,
    message: "선택한 날짜로 바로 새 휴가 요청을 시작할 수 있어요",
  };
}

function getConflictContext(chain: LeaveChainModel | null, data: LeavePageData) {
  return (
    chain?.activeRequest?.leaveConflict ??
    chain?.latestRequest.leaveConflict ??
    data.overview.selectedDateContext?.leaveConflict ??
    null
  );
}

function getConflictMessages(chain: LeaveChainModel | null, data: LeavePageData) {
  const leaveConflict = getConflictContext(chain, data);
  return leaveConflict === null ? [] : getLeaveConflictMessages(leaveConflict);
}

function getCompanyEventLabel(chain: LeaveChainModel | null, data: LeavePageData) {
  const leaveConflict = getConflictContext(chain, data);

  if (leaveConflict === null || leaveConflict.companyEventContext.length === 0) {
    return null;
  }

  return leaveConflict.companyEventContext[0]?.title ?? null;
}

function SummaryTier({
  data,
  viewModel,
}: Readonly<{
  data: LeavePageData;
  viewModel: LeavePageViewModel;
}>) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
      <Card>
        <CardContent className="flex h-full flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex flex-1 flex-col gap-5 xl:flex-row xl:items-center xl:gap-8">
            <div className="min-w-[184px] space-y-2">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                남은 연차
              </p>
              <div className="space-y-1">
                <p className="text-[30px] font-semibold tracking-[-0.03em] text-[#162847]">
                  {formatLeaveDayCount(data.overview.balance.remainingDays)}
                </p>
                <p className="text-sm text-secondary">
                  총 {formatLeaveDayCount(data.overview.balance.totalDays)} 중{" "}
                  {formatLeaveDayCount(data.overview.balance.usedDays)} 사용했어요
                </p>
              </div>
            </div>

            <div className="hidden h-10 w-px bg-border xl:block" />

            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  검토 중
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {viewModel.pendingCount}건
                </p>
                <p className="text-sm text-secondary">
                  수정하거나 상태를 바로 확인할 수 있어요
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  다시 제출 필요
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {viewModel.attentionCount}건
                </p>
                <p className="text-sm text-secondary">
                  검토 사유를 보고 바로 이어서 정리해요
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  승인 일정
                </p>
                <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {viewModel.upcomingApprovedCount}건
                </p>
                <p className="text-sm text-secondary">
                  이미 승인된 휴가와 후속 요청을 함께 볼 수 있어요
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex min-h-[145px] flex-col justify-between rounded-[16px] bg-primary p-6 text-white shadow-[0_12px_24px_rgba(79,70,229,0.24)]">
        <div className="flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/12">
            <CalendarDaysIcon aria-hidden="true" className="size-4" />
          </div>
          <Badge className="bg-white/10 text-white" variant="outline">
            이번 달 계획
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-white/70">선택한 달에 잡힌 휴가 체인</p>
          <p className="text-[32px] font-bold tracking-[-0.04em] text-white tabular-nums">
            {viewModel.monthPlannedCount}건
          </p>
        </div>
      </div>
    </section>
  );
}

function TopCorrectionTier({
  candidateId,
  data,
  onChange,
  onRunChainAction,
  viewModel,
}: Readonly<{
  candidateId: string | null;
  data: LeavePageData;
  onChange: (rootRequestId: string) => void;
  onRunChainAction: (action: LeaveChainAction) => void;
  viewModel: LeavePageViewModel;
}>) {
  if (viewModel.correctionCandidates.length === 0) {
    return null;
  }

  const activeCandidate =
    viewModel.correctionCandidates.find(
      (candidate) => candidate.rootRequestId === candidateId,
    ) ?? viewModel.correctionCandidates[0];

  if (activeCandidate === undefined) {
    return null;
  }

  const companyEventLabel = getCompanyEventLabel(activeCandidate, data);
  const conflictMessages = getConflictMessages(activeCandidate, data);

  return (
    <Card>
      <CardHeader className="gap-4 border-b border-border/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CircleAlertIcon
                aria-hidden="true"
                className="size-4 text-status-danger"
              />
              <CardTitle className="text-xl tracking-[-0.03em]">
                다시 맞춰볼 휴가 요청이 있어요
              </CardTitle>
            </div>
            <CardDescription className="text-sm leading-6">
              검토가 끝난 비승인 요청만 모아 보여드려요
            </CardDescription>
          </div>
          <Badge variant="destructive">{viewModel.attentionCount}건</Badge>
        </div>

        {viewModel.correctionCandidates.length < 2 ? null : (
          <div className="flex flex-wrap gap-2">
            {viewModel.correctionCandidates.map((candidate) => (
              <Button
                key={candidate.rootRequestId}
                onClick={() => onChange(candidate.rootRequestId)}
                size="sm"
                variant={
                  candidate.rootRequestId === activeCandidate.rootRequestId
                    ? "secondary"
                    : "outline"
                }
              >
                {formatChainMenuLabel(candidate)}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(activeCandidate)}>
              {activeCandidate.statusLabel}
            </Badge>
            <span className="text-sm text-secondary">
              {formatLeaveDateTimeLabel(activeCandidate.latestRequest.reviewedAt)}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
              {activeCandidate.correctionHeadline ?? "사유를 다시 확인해 주세요"}
            </p>
            <p className="text-sm leading-6 text-secondary">
              {activeCandidate.currentSummary}
            </p>
          </div>

          {activeCandidate.reviewComment === null ? null : (
            <Alert className="border-status-danger-soft bg-status-danger-soft/40">
              <CircleAlertIcon aria-hidden="true" className="size-4 text-status-danger" />
              <AlertTitle className="text-status-danger">검토 사유</AlertTitle>
              <AlertDescription>{activeCandidate.reviewComment}</AlertDescription>
            </Alert>
          )}

          {companyEventLabel === null && conflictMessages.length === 0 ? null : (
            <div className="rounded-[14px] border border-border/80 bg-muted/55 p-4">
              <p className="text-sm font-medium text-foreground">
                다시 제출 전에 함께 볼 내용
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-secondary">
                {companyEventLabel === null ? null : (
                  <span>운영 일정: {companyEventLabel}</span>
                )}
                {conflictMessages.map((message) => (
                  <span key={message}>{message}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-[16px] border border-border/80 bg-surface-subtle p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">다음 행동</p>
            <p className="text-sm leading-6 text-secondary">
              사유를 반영한 새 요청으로 다시 제출하면 같은 체인 안에서 이어서
              검토할 수 있어요
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (activeCandidate.primaryAction !== null) {
                onRunChainAction(activeCandidate.primaryAction);
              }
            }}
            variant="secondary"
          >
            {activeCandidate.primaryAction?.label ?? "다시 제출"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarAndSelectionColumn({
  data,
  onMonthChange,
  onOpenNewComposer,
  onRunChainAction,
  onSelectDate,
  viewModel,
  visibleMonth,
}: Readonly<{
  data: LeavePageData;
  onMonthChange: (delta: number) => void;
  onOpenNewComposer: () => void;
  onRunChainAction: (action: LeaveChainAction) => void;
  onSelectDate: (date: string) => void;
  viewModel: LeavePageViewModel;
  visibleMonth: string;
}>) {
  const relatedChainsByDate = getRelatedChainsByDate(viewModel);
  const selectionState = getSelectionState(data);
  const primaryChain = viewModel.selectedDateChains[0] ?? null;
  const selectedDateConflict = data.overview.selectedDateContext?.leaveConflict ?? null;
  const selectedDateMessages =
    selectedDateConflict === null
      ? []
      : getLeaveConflictMessages(selectedDateConflict);
  const selectedDateEventLabel =
    selectedDateConflict === null || selectedDateConflict.companyEventContext.length === 0
      ? null
      : selectedDateConflict.companyEventContext[0]?.title ?? null;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader className="gap-4 border-b border-border/80 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl tracking-[-0.03em]">
                휴가 계획 캘린더
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                날짜를 고르면 해당 일정과 새 요청 흐름을 바로 볼 수 있어요
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                aria-label="이전 달"
                onClick={() => onMonthChange(-1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label="다음 달"
                onClick={() => onMonthChange(1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-medium text-foreground">
              {formatMonthTitle(visibleMonth)}
            </p>
            <Button
              disabled={!selectionState.canCreate}
              onClick={onOpenNewComposer}
              size="sm"
              variant="secondary"
            >
              새 요청 시작
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-medium text-muted-foreground">
            {weekdayLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {listCalendarDates(visibleMonth).map((item) => {
              const relatedChains = relatedChainsByDate.get(item.date) ?? [];
              const isSelected = item.date === data.selectedDate;

              return (
                <button
                  key={item.date}
                  className={cn(
                    "flex min-h-[78px] flex-col items-start rounded-[14px] border border-border/70 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/55",
                    isSelected && "border-primary bg-primary/7 shadow-[0_0_0_1px_rgba(79,70,229,0.12)]",
                    !item.inMonth && "bg-muted/40 text-muted-foreground",
                  )}
                  type="button"
                  onClick={() => onSelectDate(item.date)}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-primary" : "text-foreground",
                        !item.inMonth && "text-muted-foreground",
                      )}
                    >
                      {item.dayOfMonth}
                    </span>
                    {relatedChains.length === 0 ? null : (
                      <span className="text-[10px] text-secondary">
                        {relatedChains.length}건
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        relatedChains.length === 0
                          ? "bg-muted-foreground/30"
                          : getCalendarToneClass(relatedChains),
                      )}
                    />
                    <span className="text-[10px] text-secondary">
                      {relatedChains.length === 0
                        ? "비어 있어요"
                        : relatedChains[0]?.statusLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2 border-b border-border/80 pb-5">
          <CardTitle className="text-xl tracking-[-0.03em]">
            {formatLeaveDateLabel(data.selectedDate)}
          </CardTitle>
          <CardDescription className="text-sm leading-6">
            선택한 날짜를 먼저 보고 필요한 흐름을 이어서 열어요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {primaryChain === null ? (
            <div className="space-y-4">
              <div className="rounded-[14px] border border-border/80 bg-surface-subtle p-4">
                <p className="text-sm font-medium text-foreground">
                  연결된 휴가 체인이 아직 없어요
                </p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  {selectionState.message}
                </p>
              </div>

              {!hasMeaningfulLeaveConflict(selectedDateConflict) ? null : (
                <Alert className="border-status-warning-soft bg-status-warning-soft/35">
                  <CircleAlertIcon aria-hidden="true" className="size-4 text-status-warning" />
                  <AlertTitle className="text-status-warning">
                    제출 전에 함께 볼 안내
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-col gap-2">
                      {selectedDateEventLabel === null ? null : (
                        <span>운영 일정: {selectedDateEventLabel}</span>
                      )}
                      {selectedDateMessages.map((message) => (
                        <span key={message}>{message}</span>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                disabled={!selectionState.canCreate}
                onClick={onOpenNewComposer}
                variant="secondary"
              >
                새 휴가 요청 열기
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3 rounded-[14px] border border-border/80 bg-surface-subtle p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {primaryChain.currentSummary}
                    </p>
                    <p className="text-sm leading-6 text-secondary">
                      {primaryChain.selectedDateSummary}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(primaryChain)}>
                    {primaryChain.statusLabel}
                  </Badge>
                </div>
                {primaryChain.activeRequest !== null &&
                primaryChain.effectiveRequest.status === "approved" ? (
                  <div className="rounded-[12px] border border-primary/15 bg-primary/6 p-3 text-sm text-secondary">
                    <p className="font-medium text-foreground">
                      현재 승인된 일정
                    </p>
                    <p className="mt-1">
                      {formatLeaveRequestSummary(primaryChain.effectiveRequest)}
                    </p>
                    <p className="mt-2">
                      후속 요청: {formatLeaveRequestSummary(primaryChain.activeRequest)}
                    </p>
                  </div>
                ) : null}

                {primaryChain.reviewComment === null ? null : (
                  <Alert className="border-status-danger-soft bg-status-danger-soft/35">
                    <CircleAlertIcon aria-hidden="true" className="size-4 text-status-danger" />
                    <AlertTitle className="text-status-danger">
                      검토 사유
                    </AlertTitle>
                    <AlertDescription>{primaryChain.reviewComment}</AlertDescription>
                  </Alert>
                )}

                {getConflictMessages(primaryChain, data).length === 0 ? null : (
                  <div className="flex flex-col gap-2 text-sm text-secondary">
                    {getCompanyEventLabel(primaryChain, data) === null ? null : (
                      <span>운영 일정: {getCompanyEventLabel(primaryChain, data)}</span>
                    )}
                    {getConflictMessages(primaryChain, data).map((message) => (
                      <span key={message}>{message}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {primaryChain.primaryAction === null ? null : (
                  <Button
                    onClick={() => onRunChainAction(primaryChain.primaryAction)}
                    size="sm"
                    variant={getActionButtonVariant(primaryChain.primaryAction)}
                  >
                    {primaryChain.primaryAction.label}
                  </Button>
                )}
                {primaryChain.secondaryAction === null ? null : (
                  <Button
                    onClick={() => onRunChainAction(primaryChain.secondaryAction)}
                    size="sm"
                    variant={getActionButtonVariant(primaryChain.secondaryAction)}
                  >
                    {primaryChain.secondaryAction.label}
                  </Button>
                )}
              </div>

              {viewModel.selectedDateChains.length < 2 ? null : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    같은 날짜의 다른 이력
                  </p>
                  <div className="flex flex-col gap-2">
                    {viewModel.selectedDateChains.slice(1).map((chain) => (
                      <div
                        key={chain.rootRequestId}
                        className="flex items-center justify-between gap-3 rounded-[12px] border border-border/70 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {chain.currentSummary}
                          </p>
                          <p className="truncate text-[12px] text-secondary">
                            {chain.statusDescription}
                          </p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(chain)}>
                          {chain.statusLabel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getComposerHeading(mode: LeaveComposerDraft["mode"]) {
  switch (mode) {
    case "new":
      return "새 휴가 요청";
    case "edit":
      return "휴가 요청 수정";
    case "resubmit":
      return "휴가 요청 다시 제출";
    case "change":
      return "승인된 휴가 변경";
    case "cancel":
      return "승인된 휴가 취소";
  }
}

function getComposerDescription(mode: LeaveComposerDraft["mode"]) {
  switch (mode) {
    case "new":
      return "선택한 날짜를 기준으로 휴가 유형과 사유를 정리해 제출해요";
    case "edit":
      return "검토 전에 필요한 내용만 바로 수정할 수 있어요";
    case "resubmit":
      return "검토 사유를 반영해 수정한 뒤 다시 제출해요";
    case "change":
      return "현재 승인된 일정은 유지한 채 변경 요청을 새로 남겨요";
    case "cancel":
      return "현재 승인된 일정의 취소 사유를 남기고 검토를 요청해요";
  }
}

function getComposerSubmitLabel(mode: LeaveComposerDraft["mode"]) {
  switch (mode) {
    case "new":
      return "휴가 요청 제출";
    case "edit":
      return "수정 내용 저장";
    case "resubmit":
      return "다시 제출";
    case "change":
      return "변경 요청 제출";
    case "cancel":
      return "취소 요청 제출";
  }
}

function getComposerHours(draft: LeaveComposerDraft) {
  if (draft.leaveType !== "hourly") {
    return null;
  }

  const startAt = buildDateTimeFromDateAndTime(draft.date, draft.startTime);
  const endAt = buildDateTimeFromDateAndTime(draft.date, draft.endTime);

  if (startAt === null || endAt === null) {
    return null;
  }

  const diffMinutes =
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000;

  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) {
    return null;
  }

  return diffMinutes / 60;
}

function isComposerSubmittable(draft: LeaveComposerDraft | null) {
  if (draft === null || draft.reason.trim().length === 0) {
    return false;
  }

  if (draft.leaveType !== "hourly") {
    return draft.date.length > 0;
  }

  return getComposerHours(draft) !== null;
}

function ComposerPanel({
  composerChain,
  composerDraft,
  isSubmitting,
  mutationError,
  onClearComposer,
  onComposerFieldChange,
  onSubmitComposer,
}: Readonly<{
  composerChain: LeaveChainModel | null;
  composerDraft: LeaveComposerDraft | null;
  isSubmitting: boolean;
  mutationError: string | null;
  onClearComposer: () => void;
  onComposerFieldChange: (patch: Partial<LeaveComposerDraft>) => void;
  onSubmitComposer: () => void;
}>) {
  if (composerDraft === null) {
    return (
      <Card>
        <CardContent className="py-10">
          <Empty className="border-border/80 bg-surface-subtle">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileClockIcon aria-hidden="true" className="size-4" />
              </EmptyMedia>
              <EmptyTitle>인라인 작성기를 여기서 이어서 써요</EmptyTitle>
              <EmptyDescription>
                달력 날짜를 고르거나 이력의 작업 버튼을 눌러 필요한 흐름을 열 수
                있어요
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const isCancelMode = composerDraft.mode === "cancel";
  const isHourly = composerDraft.leaveType === "hourly";
  const derivedHours = getComposerHours(composerDraft);
  const submitDisabled = isSubmitting || !isComposerSubmittable(composerDraft);

  return (
    <Card>
      <CardHeader className="gap-2 border-b border-border/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl tracking-[-0.03em]">
              {getComposerHeading(composerDraft.mode)}
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              {getComposerDescription(composerDraft.mode)}
            </CardDescription>
          </div>
          <Button onClick={onClearComposer} size="sm" variant="outline">
            접기
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {mutationError === null ? null : (
          <Alert aria-live="polite" variant="destructive">
            <CircleAlertIcon aria-hidden="true" className="size-4" />
            <AlertTitle>요청을 바로 처리하지 못했어요</AlertTitle>
            <AlertDescription>{mutationError}</AlertDescription>
          </Alert>
        )}

        {composerChain === null ? null : (
          <div className="rounded-[14px] border border-border/80 bg-surface-subtle p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusBadgeVariant(composerChain)}>
                {composerChain.statusLabel}
              </Badge>
              <span className="text-sm text-secondary">
                {composerChain.currentSummary}
              </span>
            </div>
            {composerChain.reviewComment === null ? null : (
              <p className="mt-3 text-sm leading-6 text-secondary">
                검토 사유: {composerChain.reviewComment}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">휴가 날짜</span>
            <Input
              autoComplete="off"
              disabled={isSubmitting || isCancelMode}
              name="date"
              type="date"
              value={composerDraft.date}
              onChange={(event) =>
                onComposerFieldChange({
                  date: event.currentTarget.value,
                })
              }
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">휴가 유형</span>
            <ToggleGroup
              aria-label="휴가 유형"
              className="flex flex-wrap justify-start rounded-[12px] border border-border/80 bg-muted/70 p-1"
              disabled={isSubmitting || isCancelMode}
              type="single"
              value={composerDraft.leaveType}
              onValueChange={(value) => {
                if (value === "") {
                  return;
                }

                onComposerFieldChange({
                  endTime: value === "hourly" ? composerDraft.endTime : "",
                  leaveType: value as LeaveComposerDraft["leaveType"],
                  startTime: value === "hourly" ? composerDraft.startTime : "",
                });
              }}
            >
              <ToggleGroupItem value="annual">연차</ToggleGroupItem>
              <ToggleGroupItem value="half_am">오전 반차</ToggleGroupItem>
              <ToggleGroupItem value="half_pm">오후 반차</ToggleGroupItem>
              <ToggleGroupItem value="hourly">시간차</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {!isHourly ? null : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">시작 시간</span>
              <Input
                autoComplete="off"
                disabled={isSubmitting || isCancelMode}
                name="startTime"
                type="time"
                value={composerDraft.startTime}
                onChange={(event) =>
                  onComposerFieldChange({
                    startTime: event.currentTarget.value,
                  })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">종료 시간</span>
              <Input
                autoComplete="off"
                disabled={isSubmitting || isCancelMode}
                name="endTime"
                type="time"
                value={composerDraft.endTime}
                onChange={(event) =>
                  onComposerFieldChange({
                    endTime: event.currentTarget.value,
                  })
                }
              />
            </label>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">계산된 시간</span>
              <div className="flex h-10 items-center rounded-[12px] border border-border/80 bg-surface-subtle px-3 text-sm font-medium text-foreground">
                {formatHourlyDurationHours(derivedHours)}
              </div>
            </div>
          </div>
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">사유</span>
          <Textarea
            autoComplete="off"
            disabled={isSubmitting}
            name="reason"
            placeholder="관리자가 빠르게 이해할 수 있게 필요한 맥락을 적어 주세요"
            value={composerDraft.reason}
            onChange={(event) =>
              onComposerFieldChange({
                reason: event.currentTarget.value,
              })
            }
          />
        </label>

        {isHourly && derivedHours === null ? (
          <p aria-live="polite" className="text-sm text-status-danger">
            시간차는 시작 시간과 종료 시간을 올바르게 입력해 주세요
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={isSubmitting} onClick={onClearComposer} variant="outline">
            닫기
          </Button>
          <Button disabled={submitDisabled} onClick={onSubmitComposer} variant="secondary">
            {getComposerSubmitLabel(composerDraft.mode)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistorySection({
  onRunChainAction,
  viewModel,
}: Readonly<{
  onRunChainAction: (action: LeaveChainAction) => void;
  viewModel: LeavePageViewModel;
}>) {
  return (
    <Card className="scroll-mt-20">
      <CardHeader className="gap-2 border-b border-border/80 pb-5">
        <CardTitle className="text-xl tracking-[-0.03em]">휴가 이력</CardTitle>
        <CardDescription className="text-sm leading-6">
          체인 단위로 최근 활동을 묶어 보고 바로 이어서 수정하거나 다시 제출해요
        </CardDescription>
      </CardHeader>

      {viewModel.visibleChains.length === 0 ? (
        <CardContent className="py-10">
          <Empty className="border-border/80 bg-surface-subtle">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListTodoIcon aria-hidden="true" className="size-4" />
              </EmptyMedia>
              <EmptyTitle>아직 휴가 이력이 없어요</EmptyTitle>
              <EmptyDescription>
                새 요청을 만들면 이 영역에서 진행 상태를 함께 확인할 수 있어요
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>휴가 일정</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>최근 활동</TableHead>
                <TableHead>사유</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewModel.visibleChains.map((chain) => (
                <TableRow key={chain.rootRequestId}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {chain.currentSummary}
                      </p>
                      <p className="text-sm text-secondary">
                        {formatLeaveTypeLabel(chain.latestRequest.leaveType)} · 단계{" "}
                        {chain.requests.length}개
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      <Badge variant={getStatusBadgeVariant(chain)}>
                        {chain.statusLabel}
                      </Badge>
                      <p className="max-w-[180px] text-sm leading-6 text-secondary">
                        {chain.statusDescription}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-secondary">
                    <div className="space-y-1">
                      <p>{chain.latestActivityLabel}</p>
                      <p>{formatLeaveDateTimeLabel(chain.latestActivityAt)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="max-w-[280px] space-y-2 text-sm leading-6 text-secondary">
                      <p className="line-clamp-2">{chain.reasonSummary}</p>
                      {chain.reviewComment === null ? null : (
                        <p className="line-clamp-2 text-status-danger">
                          검토 사유: {chain.reviewComment}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      {chain.primaryAction === null ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        <Button
                          onClick={() => onRunChainAction(chain.primaryAction)}
                          size="sm"
                          variant={getActionButtonVariant(chain.primaryAction)}
                        >
                          {chain.primaryAction.label}
                        </Button>
                      )}
                      {chain.secondaryAction === null ? null : (
                        <Button
                          onClick={() => onRunChainAction(chain.secondaryAction)}
                          size="sm"
                          variant={getActionButtonVariant(chain.secondaryAction)}
                        >
                          {chain.secondaryAction.label}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border/80 px-6 py-4 text-[11px] text-muted-foreground">
            최근 활동 기준으로 {viewModel.totalChains}개 체인을 보여주고 있어요
          </div>
        </>
      )}
    </Card>
  );
}

export function LeavePageScreen({
  composerChain,
  composerDraft,
  correctionCandidateId,
  data,
  isSubmitting,
  mutationError,
  onClearComposer,
  onComposerFieldChange,
  onCorrectionCandidateChange,
  onMonthChange,
  onOpenNewComposer,
  onRunChainAction,
  onSelectDate,
  onSubmitComposer,
  viewModel,
  visibleMonth,
}: LeavePageScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          휴가 관리
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          남은 휴가를 확인하고 필요한 일정과 검토 이력을 한 화면에서 맞춰요
        </p>
      </header>

      <SummaryTier data={data} viewModel={viewModel} />

      <TopCorrectionTier
        candidateId={correctionCandidateId}
        data={data}
        onChange={onCorrectionCandidateChange}
        onRunChainAction={onRunChainAction}
        viewModel={viewModel}
      />

      <section className="grid gap-8 xl:items-start xl:grid-cols-[340px_minmax(0,1fr)]">
        <CalendarAndSelectionColumn
          data={data}
          onMonthChange={onMonthChange}
          onOpenNewComposer={onOpenNewComposer}
          onRunChainAction={onRunChainAction}
          onSelectDate={onSelectDate}
          viewModel={viewModel}
          visibleMonth={visibleMonth}
        />
        <div className="flex flex-col gap-8">
          <ComposerPanel
            composerChain={composerChain}
            composerDraft={composerDraft}
            isSubmitting={isSubmitting}
            mutationError={mutationError}
            onClearComposer={onClearComposer}
            onComposerFieldChange={onComposerFieldChange}
            onSubmitComposer={onSubmitComposer}
          />
          <HistorySection onRunChainAction={onRunChainAction} viewModel={viewModel} />
        </div>
      </section>
    </div>
  );
}
