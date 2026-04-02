"use client";

import { useState } from "react";

import {
  buildDateTimeFromDateAndTime,
  formatAttendanceDate,
  formatAttendanceTime,
  formatRequestStatus,
  formatTimeInputValue,
} from "@/app/(erp)/(employee)/attendance/_lib/format";
import type {
  AttendanceManualRequestDraft,
  AttendanceSheetState,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ManualAttendanceAction } from "@/lib/contracts/shared";

type AttendanceSharedSheetProps = {
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onEditPendingRequest: () => void;
  onResubmitRequest: () => void;
  onSubmit: (draft: AttendanceManualRequestDraft) => void;
  onWithdrawPendingRequest: () => void;
  state: AttendanceSheetState | null;
};

type EditableAttendanceSheetState = Extract<
  AttendanceSheetState,
  { kind: "create" | "pending_edit" | "review_resubmit" }
>;

function ManualRequestSummary({
  action,
  date,
  reason,
  requestedClockInAt,
  requestedClockOutAt,
}: AttendanceManualRequestDraft) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatAttendanceDate(date)}</Badge>
        <Badge variant="outline">
          {action === "clock_in"
            ? "출근"
            : action === "clock_out"
              ? "퇴근"
              : "출근 + 퇴근"}
        </Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            출근 시간
          </dt>
          <dd>{formatAttendanceTime(requestedClockInAt)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">
            퇴근 시간
          </dt>
          <dd>{formatAttendanceTime(requestedClockOutAt)}</dd>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">사유</dt>
          <dd className="whitespace-pre-wrap text-sm text-foreground">
            {reason}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function EditableRequestForm({
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  onWithdrawPendingRequest,
  state,
}: {
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (draft: AttendanceManualRequestDraft) => void;
  onWithdrawPendingRequest: () => void;
  state: EditableAttendanceSheetState;
}) {
  const [action, setAction] = useState<ManualAttendanceAction>(
    state.draft.action,
  );
  const [date, setDate] = useState(state.draft.date);
  const [requestedClockInAt, setRequestedClockInAt] = useState(
    formatTimeInputValue(state.draft.requestedClockInAt),
  );
  const [requestedClockOutAt, setRequestedClockOutAt] = useState(
    formatTimeInputValue(state.draft.requestedClockOutAt),
  );
  const [reason, setReason] = useState(state.draft.reason);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (reason.trim().length === 0) {
      setLocalError("사유를 입력해 주세요");
      return;
    }

    if (date.length === 0) {
      setLocalError("대상 날짜를 확인해 주세요");
      return;
    }

    if (
      (action === "clock_in" || action === "both") &&
      requestedClockInAt === ""
    ) {
      setLocalError("출근 시간을 입력해 주세요");
      return;
    }

    if (
      (action === "clock_out" || action === "both") &&
      requestedClockOutAt === ""
    ) {
      setLocalError("퇴근 시간을 입력해 주세요");
      return;
    }

    setLocalError(null);
    onSubmit({
      date,
      action,
      requestedClockInAt: buildDateTimeFromDateAndTime(
        date,
        requestedClockInAt,
      ),
      requestedClockOutAt: buildDateTimeFromDateAndTime(
        date,
        requestedClockOutAt,
      ),
      reason: reason.trim(),
    });
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {state.kind === "review_resubmit" &&
        state.request.governingReviewComment !== null ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              이전 검토 사유
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {state.request.governingReviewComment}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="attendance-target-date">대상 날짜</Label>
          <Input
            autoComplete="off"
            disabled={!state.dateEditable || isSubmitting}
            id="attendance-target-date"
            name="attendance-target-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>정정 유형</Label>
          <ToggleGroup
            className="w-full"
            disabled={isSubmitting}
            type="single"
            value={action}
            onValueChange={(value) => {
              if (value === "") {
                return;
              }

              setAction(value as ManualAttendanceAction);
            }}
          >
            <ToggleGroupItem className="flex-1" value="clock_in">
              출근
            </ToggleGroupItem>
            <ToggleGroupItem className="flex-1" value="clock_out">
              퇴근
            </ToggleGroupItem>
            <ToggleGroupItem className="flex-1" value="both">
              둘 다
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {(action === "clock_in" || action === "both") && (
          <div className="space-y-2">
            <Label htmlFor="attendance-clock-in-time">출근 시간</Label>
            <Input
              autoComplete="off"
              disabled={isSubmitting}
              id="attendance-clock-in-time"
              name="attendance-clock-in-time"
              type="time"
              value={requestedClockInAt}
              onChange={(event) => {
                setLocalError(null);
                setRequestedClockInAt(event.target.value);
              }}
            />
          </div>
        )}

        {(action === "clock_out" || action === "both") && (
          <div className="space-y-2">
            <Label htmlFor="attendance-clock-out-time">퇴근 시간</Label>
            <Input
              autoComplete="off"
              disabled={isSubmitting}
              id="attendance-clock-out-time"
              name="attendance-clock-out-time"
              type="time"
              value={requestedClockOutAt}
              onChange={(event) => {
                setLocalError(null);
                setRequestedClockOutAt(event.target.value);
              }}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="attendance-reason">사유</Label>
          <Textarea
            autoComplete="off"
            disabled={isSubmitting}
            id="attendance-reason"
            name="attendance-reason"
            placeholder="왜 정정이 필요한지 남겨 주세요…"
            value={reason}
            onChange={(event) => {
              setLocalError(null);
              setReason(event.target.value);
            }}
          />
        </div>

        {localError !== null || errorMessage !== null ? (
          <>
            <Separator />
            <p
              aria-live="polite"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {localError ?? errorMessage}
            </p>
          </>
        ) : null}
      </div>

      <SheetFooter className="border-t border-border">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {state.kind === "pending_edit" ? (
            <Button
              disabled={isSubmitting}
              variant="destructive"
              onClick={onWithdrawPendingRequest}
            >
              철회
            </Button>
          ) : null}
          <Button disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? "처리 중…" : state.ctaLabel}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

export function AttendanceSharedSheet({
  errorMessage,
  isSubmitting,
  onClose,
  onEditPendingRequest,
  onResubmitRequest,
  onSubmit,
  onWithdrawPendingRequest,
  state,
}: AttendanceSharedSheetProps) {
  const isEditable =
    state?.kind === "create" ||
    state?.kind === "pending_edit" ||
    state?.kind === "review_resubmit";

  return (
    <Sheet open={state !== null} onOpenChange={(open) => !open && onClose()}>
      {state === null ? null : (
        <SheetContent className="w-full overscroll-contain sm:max-w-xl">
          <SheetHeader className="gap-2 border-b border-border">
            <div className="flex items-center gap-2">
              {"request" in state ? (
                <Badge variant="outline">
                  {formatRequestStatus(state.request)}
                </Badge>
              ) : null}
              <Badge
                variant={
                  state.tone === "destructive" ? "destructive" : "outline"
                }
              >
                {state.kind === "leave_conflict" ? "충돌 확인" : "정정 흐름"}
              </Badge>
            </div>
            <SheetTitle>{state.title}</SheetTitle>
            <SheetDescription>{state.description}</SheetDescription>
          </SheetHeader>

          {state.kind === "leave_conflict" ? (
            <>
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                  <p>
                    승인된 휴가 정보와 실제 근무 기록이 같은 날짜에 함께 보이고
                    있어요
                  </p>
                  <p>
                    지금 이 화면에서는 즉시 정정 요청을 쓰지 않고, 현재 휴가
                    상태와 근무 사실을 먼저 함께 확인하는 흐름으로 안내해요
                  </p>
                </div>
              </div>
              <SheetFooter className="border-t border-border">
                <Button variant="outline" onClick={onClose}>
                  닫기
                </Button>
              </SheetFooter>
            </>
          ) : null}

          {state.kind === "pending" || state.kind === "review" ? (
            <>
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
                <ManualRequestSummary {...state.draft} />
                {state.request.governingReviewComment !== null ? (
                  <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      검토 사유
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {state.request.governingReviewComment}
                    </p>
                  </div>
                ) : null}
                {errorMessage !== null ? (
                  <>
                    <Separator />
                    <p
                      aria-live="polite"
                      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {errorMessage}
                    </p>
                  </>
                ) : null}
              </div>
              <SheetFooter className="border-t border-border">
                {state.kind === "pending" ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={onClose}>
                      닫기
                    </Button>
                    <Button variant="outline" onClick={onEditPendingRequest}>
                      내용 수정
                    </Button>
                    <Button
                      disabled={isSubmitting}
                      variant="destructive"
                      onClick={onWithdrawPendingRequest}
                    >
                      철회
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={onClose}>
                      닫기
                    </Button>
                    <Button onClick={onResubmitRequest}>다시 제출</Button>
                  </div>
                )}
              </SheetFooter>
            </>
          ) : null}

          {isEditable ? (
            <EditableRequestForm
              key={`${state.kind}:${state.id}`}
              errorMessage={errorMessage}
              isSubmitting={isSubmitting}
              state={state}
              onClose={onClose}
              onSubmit={onSubmit}
              onWithdrawPendingRequest={onWithdrawPendingRequest}
            />
          ) : null}
        </SheetContent>
      )}
    </Sheet>
  );
}
