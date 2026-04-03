"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tone = "default" | "warning" | "history" | "subtle";

export type AdminRequestFactRow = Readonly<{
  detail: string;
  label: string;
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
  requestTypeLabel: string;
  reviewedAtLabel?: string | null;
  reviewComment?: string;
  reviewCommentInputId?: string;
  showReviewCommentInput?: boolean;
  submittedAtLabel: string;
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

function FactTable({ facts }: Readonly<{ facts: AdminRequestFactRow[] }>) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border/80">
      <Table>
        <TableBody>
          {facts.map((fact) => (
            <TableRow
              key={`${fact.label}-${fact.detail}`}
              className={cn(getToneClasses(fact.tone ?? "subtle"))}
            >
              <TableCell className="w-[124px] align-top text-xs font-medium text-muted-foreground">
                {fact.label}
              </TableCell>
              <TableCell className="align-top text-sm leading-6 text-foreground">
                {fact.detail}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  const activeWarningConfirmation =
    warningConfirmation !== null && warningConfirmation !== undefined
      ? warningConfirmation
      : null;
  const needsWarningConfirmation = activeWarningConfirmation !== null;

  return (
    <Card className="gap-0 border-border/80 bg-card">
      <CardHeader className="gap-2 border-b border-border/60 bg-muted/20">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge>검토 결정</ToneBadge>
          <span className="text-sm text-muted-foreground">
            {requestTypeLabel}
          </span>
        </div>
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
              placeholder="반려하거나 보완 요청하는 이유를 적어 주세요"
              value={reviewComment}
              onChange={(event) => onRequestCommentChange?.(event.target.value)}
            />
          </div>
        ) : null}

        {needsWarningConfirmation && isWarningConfirmationActive ? (
          <Alert className="border-status-warning/20 bg-status-warning-soft/30">
            <AlertTitle>승인 전 마지막 확인이 필요해요</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <p className="font-medium text-foreground">
                  {activeWarningConfirmation.summary}
                </p>
                {activeWarningConfirmation.lines.map((line) => (
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
  requestTypeLabel,
  reviewedAtLabel,
  reviewComment = "",
  reviewCommentInputId,
  showReviewCommentInput = false,
  submittedAtLabel,
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
              </AlertDescription>
            </Alert>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <FactTable facts={facts} />
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
