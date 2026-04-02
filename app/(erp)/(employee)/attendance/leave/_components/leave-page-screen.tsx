import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  FileClockIcon,
  ListTodoIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import {
  buildDateTimeFromDateAndTime,
  formatHourlyDurationHours,
  formatLeaveDateLabel,
  formatLeaveDateTimeLabel,
  formatLeaveRequestSummary,
  formatLeaveTimeLabel,
  formatLeaveTypeLabel,
  getLeaveConflictMessages,
  hasMeaningfulLeaveConflict,
} from "@/app/(erp)/(employee)/attendance/leave/_lib/format";
import type { LeavePageData } from "@/app/(erp)/(employee)/attendance/leave/_lib/page-data";
import {
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
  composerScrollIntent: Readonly<{
    date: string;
    token: number;
  }> | null;
  data: LeavePageData;
  isSubmitting: boolean;
  mutationError: string | null;
  onClearComposer: () => void;
  onComposerScrollComplete: () => void;
  onComposerFieldChange: (patch: Partial<LeaveComposerDraft>) => void;
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
        chain.activeRequest === null &&
        chain.effectiveRequest.status === "approved",
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

      if (
        !existing.some((item) => item.rootRequestId === chain.rootRequestId)
      ) {
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

function getConflictContext(
  chain: LeaveChainModel | null,
  data: LeavePageData,
) {
  return (
    chain?.activeRequest?.leaveConflict ??
    chain?.latestRequest.leaveConflict ??
    data.overview.selectedDateContext?.leaveConflict ??
    null
  );
}

function getConflictMessages(
  chain: LeaveChainModel | null,
  data: LeavePageData,
) {
  const leaveConflict = getConflictContext(chain, data);
  return leaveConflict === null ? [] : getLeaveConflictMessages(leaveConflict);
}

function getCompanyEventLabel(
  chain: LeaveChainModel | null,
  data: LeavePageData,
) {
  const leaveConflict = getConflictContext(chain, data);

  if (
    leaveConflict === null ||
    leaveConflict.companyEventContext.length === 0
  ) {
    return null;
  }

  return leaveConflict.companyEventContext[0]?.title ?? null;
}

function formatHistoryRequestDetail(chain: LeaveChainModel) {
  const request = chain.activeRequest ?? chain.effectiveRequest;

  return formatLeaveRequestDetail(request);
}

function formatLeaveRequestDetail(input: {
  leaveType: LeaveChainModel["effectiveRequest"]["leaveType"];
  startAt: string | null;
  endAt: string | null;
}) {
  if (input.leaveType === "hourly") {
    return `${formatLeaveTimeLabel(input.startAt)} ~ ${formatLeaveTimeLabel(input.endAt)}`;
  }

  switch (input.leaveType) {
    case "annual":
      return "연차";
    case "half_am":
      return "오전 반차";
    case "half_pm":
      return "오후 반차";
  }
}

function DetailField({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <div className="grid gap-1 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <div className="min-w-0 text-sm leading-6 text-foreground">
        {children}
      </div>
    </div>
  );
}

function SummaryTier({
  viewModel,
}: Readonly<{
  viewModel: LeavePageViewModel;
}>) {
  return (
    <section>
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              다시 제출 필요
            </p>
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {viewModel.revisionRequestedCount}건
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              승인됨
            </p>
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {viewModel.approvedCount}건
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              검토중
            </p>
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {viewModel.pendingCount}건
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              반려됨
            </p>
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {viewModel.rejectedCount}건
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function TopCorrectionTier({
  data,
  onRunChainAction,
  viewModel,
}: Readonly<{
  data: LeavePageData;
  onRunChainAction: (action: LeaveChainAction) => void;
  viewModel: LeavePageViewModel;
}>) {
  if (viewModel.correctionCandidates.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="gap-2 border-b border-border/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CircleAlertIcon
                aria-hidden="true"
                className="size-4 text-status-danger"
              />
              <CardTitle className="text-xl tracking-[-0.03em]">
                다시 제출이 필요한 요청
              </CardTitle>
            </div>
            <CardDescription className="text-sm leading-6">
              보완 요청을 받은 신청을 다시 제출해요
            </CardDescription>
          </div>
          <Badge variant="destructive">{viewModel.attentionCount}건</Badge>
        </div>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>휴가 일정</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>현재 상태</TableHead>
            <TableHead>검토 메모</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viewModel.correctionCandidates.map((candidate) => {
            const companyEventLabel = getCompanyEventLabel(candidate, data);
            const conflictMessages = getConflictMessages(candidate, data);
            const primaryAction = candidate.primaryAction;

            return (
              <TableRow key={candidate.rootRequestId}>
                <TableCell className="align-top">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {candidate.currentSummary}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="align-top text-sm text-secondary">
                  {formatLeaveTypeLabel(candidate.latestRequest.leaveType)}
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <Badge variant={getStatusBadgeVariant(candidate)}>
                      {candidate.statusLabel}
                    </Badge>
                    <p className="text-sm text-secondary">
                      {formatLeaveDateTimeLabel(candidate.latestActivityAt)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="max-w-[320px] space-y-2 text-sm leading-6 text-secondary">
                    <p className="line-clamp-2 text-status-danger">
                      {candidate.reviewComment ?? "남긴 검토 메모가 없어요"}
                    </p>
                    {companyEventLabel === null ? null : (
                      <p className="line-clamp-2">
                        운영 일정: {companyEventLabel}
                      </p>
                    )}
                    {conflictMessages.map((message) => (
                      <p key={message} className="line-clamp-2">
                        {message}
                      </p>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end">
                    {primaryAction === null ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : (
                      <Button
                        onClick={() => onRunChainAction(primaryAction)}
                        size="sm"
                        variant={getActionButtonVariant(primaryAction)}
                      >
                        {primaryAction.label}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function CalendarPanel({
  data,
  onMonthChange,
  onSelectDate,
  viewModel,
  visibleMonth,
}: Readonly<{
  data: LeavePageData;
  onMonthChange: (delta: number) => void;
  onSelectDate: (date: string) => void;
  viewModel: LeavePageViewModel;
  visibleMonth: string;
}>) {
  const relatedChainsByDate = getRelatedChainsByDate(viewModel);

  return (
    <Card>
      <CardHeader className="border-b border-border/80 pb-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-medium text-foreground">
            {formatMonthTitle(visibleMonth)}
          </p>
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
                  isSelected &&
                    "border-primary bg-primary/7 shadow-[0_0_0_1px_rgba(79,70,229,0.12)]",
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
                {relatedChains.length === 0 ? null : (
                  <div className="mt-auto flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        getCalendarToneClass(relatedChains),
                      )}
                    />
                    <span className="text-[10px] text-secondary">
                      {relatedChains[0]?.statusLabel}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedDateContextPanel({
  data,
  onOpenNewComposer,
  onRunChainAction,
  viewModel,
}: Readonly<{
  data: LeavePageData;
  onOpenNewComposer: () => void;
  onRunChainAction: (action: LeaveChainAction) => void;
  viewModel: LeavePageViewModel;
}>) {
  const selectionState = getSelectionState(data);
  const primaryChain = viewModel.selectedDateChains[0] ?? null;
  const selectedDateConflict =
    data.overview.selectedDateContext?.leaveConflict ?? null;
  const selectedDateMessages =
    selectedDateConflict === null
      ? []
      : getLeaveConflictMessages(selectedDateConflict);
  const selectedDateEventLabel =
    selectedDateConflict === null ||
    selectedDateConflict.companyEventContext.length === 0
      ? null
      : (selectedDateConflict.companyEventContext[0]?.title ?? null);
  const primaryAction = primaryChain?.primaryAction ?? null;
  const secondaryAction = primaryChain?.secondaryAction ?? null;

  return (
    <Card>
      <CardHeader className="border-b border-border/80 pb-5">
        <CardTitle className="text-xl tracking-[-0.03em]">
          {formatLeaveDateLabel(data.selectedDate)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {primaryChain === null ? (
          <div className="space-y-4">
            <div className="rounded-[14px] border border-border/80 bg-surface-subtle p-4">
              <p className="text-sm font-medium text-foreground">
                이 날짜에는 신청내역이 없어요
              </p>
              {!selectionState.canCreate ? (
                <p className="mt-2 text-sm leading-6 text-secondary">
                  {selectionState.message}
                </p>
              ) : null}
            </div>

            {!hasMeaningfulLeaveConflict(selectedDateConflict) ? null : (
              <Alert className="border-status-warning-soft bg-status-warning-soft/35">
                <CircleAlertIcon
                  aria-hidden="true"
                  className="size-4 text-status-warning"
                />
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
            <div className="rounded-[14px] border border-border/80 bg-surface-subtle p-4">
              <DetailField label="유형">
                {formatLeaveTypeLabel(
                  (primaryChain.activeRequest ?? primaryChain.effectiveRequest)
                    .leaveType,
                )}
              </DetailField>
              <DetailField label="날짜">
                {formatLeaveDateLabel(
                  (primaryChain.activeRequest ?? primaryChain.effectiveRequest)
                    .date,
                )}
              </DetailField>
              <DetailField label="세부사항">
                {formatLeaveRequestDetail(
                  primaryChain.activeRequest ?? primaryChain.effectiveRequest,
                )}
              </DetailField>
              <DetailField label="상태">
                <Badge variant={getStatusBadgeVariant(primaryChain)}>
                  {primaryChain.statusLabel}
                </Badge>
              </DetailField>
              <DetailField label="사유">
                <p className="break-words whitespace-normal">
                  {primaryChain.reasonSummary}
                </p>
              </DetailField>
              {primaryChain.reviewComment === null ? null : (
                <DetailField label="검토 메모">
                  <p className="break-words whitespace-normal text-status-danger">
                    {primaryChain.reviewComment}
                  </p>
                </DetailField>
              )}
              {primaryChain.activeRequest !== null &&
              primaryChain.effectiveRequest.status === "approved" ? (
                <DetailField label="현재 승인 일정">
                  <div className="space-y-1 text-secondary">
                    <p className="font-medium text-foreground">
                      {formatLeaveRequestSummary(primaryChain.effectiveRequest)}
                    </p>
                    <p>
                      후속 요청:{" "}
                      {formatLeaveRequestSummary(primaryChain.activeRequest)}
                    </p>
                  </div>
                </DetailField>
              ) : null}
              {getCompanyEventLabel(primaryChain, data) === null ? null : (
                <DetailField label="운영 일정">
                  {getCompanyEventLabel(primaryChain, data)}
                </DetailField>
              )}
              {getConflictMessages(primaryChain, data).length === 0 ? null : (
                <DetailField label="충돌 안내">
                  <div className="space-y-1 text-secondary">
                    {getConflictMessages(primaryChain, data).map((message) => (
                      <p key={message}>{message}</p>
                    ))}
                  </div>
                </DetailField>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {primaryAction === null ? null : (
                <Button
                  onClick={() => onRunChainAction(primaryAction)}
                  size="sm"
                  variant={getActionButtonVariant(primaryAction)}
                >
                  {primaryAction.label}
                </Button>
              )}
              {secondaryAction === null ? null : (
                <Button
                  onClick={() => onRunChainAction(secondaryAction)}
                  size="sm"
                  variant={getActionButtonVariant(secondaryAction)}
                >
                  {secondaryAction.label}
                </Button>
              )}
            </div>

            {viewModel.selectedDateChains.length < 2 ? null : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  같은 날짜의 다른 신청
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
            <span className="text-sm font-medium text-foreground">
              휴가 날짜
            </span>
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
            <span className="text-sm font-medium text-foreground">
              휴가 유형
            </span>
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
              <span className="text-sm font-medium text-foreground">
                시작 시간
              </span>
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
              <span className="text-sm font-medium text-foreground">
                종료 시간
              </span>
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
              <span className="text-sm font-medium text-foreground">
                계산된 시간
              </span>
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
            placeholder="예: 병원 진료 일정이 있어 연차가 필요해요…"
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
          <Button
            disabled={isSubmitting}
            onClick={onClearComposer}
            variant="outline"
          >
            닫기
          </Button>
          <Button
            disabled={submitDisabled}
            onClick={onSubmitComposer}
            variant="secondary"
          >
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
      <CardHeader className="border-b border-border/80 pb-5">
        <CardTitle className="text-xl tracking-[-0.03em]">
          휴가 신청내역
        </CardTitle>
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
                <TableHead>유형</TableHead>
                <TableHead>날짜</TableHead>
                <TableHead>세부사항</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>사유</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewModel.visibleChains.map((chain) => {
                const primaryAction = chain.primaryAction;
                const secondaryAction = chain.secondaryAction;

                return (
                  <TableRow key={chain.rootRequestId}>
                    <TableCell className="align-top text-sm font-medium text-foreground">
                      {formatLeaveTypeLabel(chain.latestRequest.leaveType)}
                    </TableCell>
                    <TableCell className="align-top text-sm text-secondary">
                      {formatLeaveDateLabel(chain.effectiveRequest.date)}
                    </TableCell>
                    <TableCell className="align-top">
                      <p className="max-w-[220px] break-words text-sm leading-6 text-secondary whitespace-normal">
                        {formatHistoryRequestDetail(chain)}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={getStatusBadgeVariant(chain)}>
                        {chain.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="max-w-[320px] space-y-2 text-sm leading-6 text-secondary">
                        <p className="break-words whitespace-normal">
                          {chain.reasonSummary}
                        </p>
                        {chain.reviewComment === null ? null : (
                          <p className="break-words text-status-danger whitespace-normal">
                            검토 사유: {chain.reviewComment}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        {primaryAction === null ? (
                          <span className="text-sm text-muted-foreground">
                            -
                          </span>
                        ) : (
                          <Button
                            onClick={() => onRunChainAction(primaryAction)}
                            size="sm"
                            variant={getActionButtonVariant(primaryAction)}
                          >
                            {primaryAction.label}
                          </Button>
                        )}
                        {secondaryAction === null ? null : (
                          <Button
                            onClick={() => onRunChainAction(secondaryAction)}
                            size="sm"
                            variant={getActionButtonVariant(secondaryAction)}
                          >
                            {secondaryAction.label}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}

export function LeavePageScreen({
  composerChain,
  composerDraft,
  composerScrollIntent,
  data,
  isSubmitting,
  mutationError,
  onClearComposer,
  onComposerScrollComplete,
  onComposerFieldChange,
  onMonthChange,
  onOpenNewComposer,
  onRunChainAction,
  onSelectDate,
  onSubmitComposer,
  viewModel,
  visibleMonth,
}: LeavePageScreenProps) {
  const composerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      composerDraft === null ||
      composerScrollIntent === null ||
      data.selectedDate !== composerScrollIntent.date
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      composerContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      onComposerScrollComplete();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    composerDraft,
    composerScrollIntent,
    data.selectedDate,
    onComposerScrollComplete,
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          휴가 관리
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          휴가를 신청하고 관리해요
        </p>
      </header>

      <SummaryTier viewModel={viewModel} />

      <TopCorrectionTier
        data={data}
        onRunChainAction={onRunChainAction}
        viewModel={viewModel}
      />

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)_minmax(0,1fr)]">
        <CalendarPanel
          data={data}
          onMonthChange={onMonthChange}
          onSelectDate={onSelectDate}
          viewModel={viewModel}
          visibleMonth={visibleMonth}
        />
        <SelectedDateContextPanel
          data={data}
          onOpenNewComposer={onOpenNewComposer}
          onRunChainAction={onRunChainAction}
          viewModel={viewModel}
        />
        <div ref={composerContainerRef} className="scroll-mt-20">
          <ComposerPanel
            composerChain={composerChain}
            composerDraft={composerDraft}
            isSubmitting={isSubmitting}
            mutationError={mutationError}
            onClearComposer={onClearComposer}
            onComposerFieldChange={onComposerFieldChange}
            onSubmitComposer={onSubmitComposer}
          />
        </div>
      </section>

      <HistorySection
        onRunChainAction={onRunChainAction}
        viewModel={viewModel}
      />
    </div>
  );
}
