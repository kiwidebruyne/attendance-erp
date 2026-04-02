"use client";

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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tone = "default" | "warning" | "history" | "subtle";

export type AdminRequestFactRow = Readonly<{
  detail: string;
  label: string;
  tone?: Tone;
}>;

export type AdminRequestTimelineItem = Readonly<{
  detail: string;
  title: string;
  tone?: Tone;
}>;

export type AdminRequestWarningConfirmation = Readonly<{
  lines: string[];
  summary: string;
}>;

export type AdminRequestDetailPanelProps = Readonly<{
  currentStatusLabel: string;
  employeeDepartmentLabel: string;
  employeeName: string;
  errorMessage?: string | null;
  facts: AdminRequestFactRow[];
  isPending?: boolean;
  isWarningConfirmationActive?: boolean;
  mode: "actionable" | "completed_history";
  onApprove?: () => void;
  onCancelWarningConfirmation?: () => void;
  onReject?: () => void;
  onRequestCommentChange?: (value: string) => void;
  onRequestRevision?: () => void;
  onStartWarningConfirmation?: () => void;
  requestReasonLabel: string;
  requestTimeline?: AdminRequestTimelineItem[];
  requestTypeLabel: string;
  reviewedAtLabel?: string | null;
  reviewComment?: string;
  reviewCommentInputId?: string;
  showReviewCommentInput?: boolean;
  submittedAtLabel: string;
  summaryLabel: string;
  supportingFooting: string;
  warningConfirmation?: AdminRequestWarningConfirmation | null;
}>;

function getToneClasses(tone: Tone) {
  switch (tone) {
    case "warning":
      return "border-status-warning/20 bg-status-warning-soft/30";
    case "history":
      return "border-border bg-muted/35";
    case "subtle":
      return "border-border bg-surface-subtle/60";
    case "default":
    default:
      return "border-border bg-card";
  }
}

function ToneBadge({
  children,
  tone = "default",
}: Readonly<{
  children: string;
  tone?: Tone;
}>) {
  if (tone === "warning") {
    return (
      <Badge className="bg-status-warning-soft text-status-warning">
        {children}
      </Badge>
    );
  }

  if (tone === "history") {
    return (
      <Badge className="bg-muted text-secondary" variant="outline">
        {children}
      </Badge>
    );
  }

  return <Badge variant="outline">{children}</Badge>;
}

function FactGrid({ facts }: Readonly<{ facts: AdminRequestFactRow[] }>) {
  return (
    <div className="grid gap-3">
      {facts.map((fact) => (
        <Card
          key={`${fact.label}-${fact.detail}`}
          className={cn("gap-0", getToneClasses(fact.tone ?? "subtle"))}
          size="sm"
        >
          <CardHeader className="gap-1.5">
            <CardDescription>{fact.label}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-6 text-foreground">{fact.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Timeline({
  items,
}: Readonly<{
  items: AdminRequestTimelineItem[];
}>) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={`${item.title}-${item.detail}`}
          className={cn(
            "rounded-[14px] border px-4 py-3",
            getToneClasses(item.tone ?? "history"),
          )}
        >
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActionSurface({
  isPending = false,
  isWarningConfirmationActive = false,
  onApprove,
  onCancelWarningConfirmation,
  onReject,
  onRequestCommentChange,
  onRequestRevision,
  onStartWarningConfirmation,
  requestTypeLabel,
  reviewComment = "",
  reviewCommentInputId = "admin-request-review-comment",
  showReviewCommentInput = false,
  warningConfirmation,
}: Pick<
  AdminRequestDetailPanelProps,
  | "isPending"
  | "isWarningConfirmationActive"
  | "onApprove"
  | "onCancelWarningConfirmation"
  | "onReject"
  | "onRequestCommentChange"
  | "onRequestRevision"
  | "onStartWarningConfirmation"
  | "requestTypeLabel"
  | "reviewComment"
  | "reviewCommentInputId"
  | "showReviewCommentInput"
  | "warningConfirmation"
>) {
  const hasReviewComment = reviewComment.trim().length > 0;
  const needsWarningConfirmation = warningConfirmation !== null;

  return (
    <Card className="gap-0 border-border/80 bg-card">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/20">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge>검토 결정</ToneBadge>
          <span className="text-sm text-muted-foreground">
            {requestTypeLabel}
          </span>
        </div>
        <CardDescription>
          반려와 보완 요청은 사유가 필요하고, 승인 전 확인이 필요한 항목은 별도
          확인을 거쳐요
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-5">
        {showReviewCommentInput ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={reviewCommentInputId}>검토 사유</Label>
            <Textarea
              autoComplete="off"
              className="min-h-28"
              disabled={isPending}
              id={reviewCommentInputId}
              placeholder="반려하거나 보완 요청하는 이유를 남겨 주세요"
              value={reviewComment}
              onChange={(event) => onRequestCommentChange?.(event.target.value)}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              반려와 보완 요청은 사유를 남겨야 진행할 수 있어요
            </p>
          </div>
        ) : null}

        {needsWarningConfirmation && isWarningConfirmationActive ? (
          <Alert className="border-status-warning/20 bg-status-warning-soft/30">
            <AlertTitle>승인 전 마지막 확인이 필요해요</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <p className="font-medium text-foreground">
                  {warningConfirmation.summary}
                </p>
                {warningConfirmation.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  disabled={isPending}
                  type="button"
                  variant="outline"
                  onClick={onCancelWarningConfirmation}
                >
                  다시 보기
                </Button>
                <Button disabled={isPending} type="button" onClick={onApprove}>
                  확인 후 승인
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2 border-t border-border/70 pt-4 sm:grid-cols-3">
          <Button
            disabled={isPending || !hasReviewComment}
            type="button"
            variant="outline"
            onClick={onRequestRevision}
          >
            보완 요청
          </Button>
          <Button
            disabled={isPending || !hasReviewComment}
            type="button"
            variant="destructive"
            onClick={onReject}
          >
            반려
          </Button>
          <Button
            disabled={isPending}
            type="button"
            onClick={
              needsWarningConfirmation
                ? isWarningConfirmationActive
                  ? onApprove
                  : onStartWarningConfirmation
                : onApprove
            }
          >
            {needsWarningConfirmation && !isWarningConfirmationActive
              ? "승인 전 확인"
              : "승인"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminRequestDetailPanel({
  currentStatusLabel,
  employeeDepartmentLabel,
  employeeName,
  errorMessage,
  facts,
  isPending = false,
  isWarningConfirmationActive = false,
  mode,
  onApprove,
  onCancelWarningConfirmation,
  onReject,
  onRequestCommentChange,
  onRequestRevision,
  onStartWarningConfirmation,
  requestReasonLabel,
  requestTimeline = [],
  requestTypeLabel,
  reviewedAtLabel,
  reviewComment = "",
  reviewCommentInputId,
  showReviewCommentInput = false,
  submittedAtLabel,
  summaryLabel,
  supportingFooting,
  warningConfirmation = null,
}: AdminRequestDetailPanelProps) {
  const isReadOnlyHistory = mode === "completed_history";

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{employeeName}</CardTitle>
                <Badge variant="outline">{employeeDepartmentLabel}</Badge>
              </div>
              <CardDescription>{requestTypeLabel}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{currentStatusLabel}</Badge>
              <Badge variant="outline">{submittedAtLabel}</Badge>
              {reviewedAtLabel !== null && reviewedAtLabel !== undefined ? (
                <Badge variant="outline">{reviewedAtLabel}</Badge>
              ) : null}
            </div>
          </div>

          {errorMessage !== null && errorMessage !== undefined ? (
            <Alert variant="destructive">
              <AlertTitle>검토 요청을 처리하지 못했어요</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isReadOnlyHistory ? (
            <Alert className="border-border bg-muted/30">
              <AlertTitle>완료된 검토 기록이에요</AlertTitle>
              <AlertDescription>
                이 항목은 읽기 전용으로 보여요
                <br />더 이상 같은 기록에서 관리자 작업을 이어서 할 수 없어요
              </AlertDescription>
            </Alert>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div
            className={cn(
              "rounded-[14px] border p-4",
              getToneClasses("default"),
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">요청 요약</p>
                <p className="text-sm text-muted-foreground">{summaryLabel}</p>
              </div>
              <ToneBadge tone={isReadOnlyHistory ? "history" : "default"}>
                {currentStatusLabel}
              </ToneBadge>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                사유
              </span>
              <p className="text-sm leading-6 text-foreground">
                {requestReasonLabel}
              </p>
            </div>
          </div>

          <FactGrid facts={facts} />

          {requestTimeline.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    흐름 요약
                  </p>
                  <p className="text-sm text-muted-foreground">
                    현재 상태에 이어진 검토 맥락을 짧게 확인해요
                  </p>
                </div>
                <Badge variant="outline">{requestTimeline.length}개</Badge>
              </div>
              <Timeline items={requestTimeline} />
            </div>
          ) : null}

          <div
            className={cn(
              "rounded-[14px] border px-4 py-3",
              getToneClasses("subtle"),
            )}
          >
            <p className="text-sm font-medium text-foreground">현재 안내</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {supportingFooting}
            </p>
          </div>
        </CardContent>
      </Card>

      {isReadOnlyHistory ? null : (
        <ActionSurface
          isPending={isPending}
          isWarningConfirmationActive={isWarningConfirmationActive}
          onApprove={onApprove}
          onCancelWarningConfirmation={onCancelWarningConfirmation}
          onReject={onReject}
          onRequestCommentChange={onRequestCommentChange}
          onRequestRevision={onRequestRevision}
          onStartWarningConfirmation={onStartWarningConfirmation}
          requestTypeLabel={requestTypeLabel}
          reviewComment={reviewComment}
          reviewCommentInputId={reviewCommentInputId}
          showReviewCommentInput={showReviewCommentInput}
          warningConfirmation={warningConfirmation}
        />
      )}
    </div>
  );
}
