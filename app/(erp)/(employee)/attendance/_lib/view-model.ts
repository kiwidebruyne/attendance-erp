import type {
  AttendanceHistoryResponse,
  AttendanceTodayResponse,
} from "@/lib/contracts/attendance";
import type {
  AttendanceAttempt,
  AttendanceSurfaceManualRequestResource,
  ManualAttendanceAction,
  PreviousDayOpenRecord,
} from "@/lib/contracts/shared";

export type AttendanceManualRequestDraft = Readonly<{
  date: string;
  action: ManualAttendanceAction;
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  reason: string;
}>;

export type AttendanceResubmissionDraft = AttendanceManualRequestDraft &
  Readonly<{
    parentRequestId: string;
    followUpKind: "resubmission";
  }>;

export type AttendanceSurfaceTone = "default" | "destructive";

type AttendanceSurfaceBase = Readonly<{
  ctaLabel: string;
  description: string;
  id: string;
  title: string;
  tone: AttendanceSurfaceTone;
}>;

export type AttendanceCreateSurfaceModel = AttendanceSurfaceBase &
  Readonly<{
    dateEditable: boolean;
    draft: AttendanceManualRequestDraft;
    kind: "create";
    submitLabel: string;
  }>;

export type AttendancePendingSurfaceModel = AttendanceSurfaceBase &
  Readonly<{
    dateEditable: boolean;
    draft: AttendanceManualRequestDraft;
    kind: "pending";
    request: AttendanceSurfaceManualRequestResource;
  }>;

export type AttendanceReviewSurfaceModel = AttendanceSurfaceBase &
  Readonly<{
    draft: AttendanceResubmissionDraft;
    kind: "review";
    request: AttendanceSurfaceManualRequestResource;
    submitLabel: string;
  }>;

export type AttendanceLeaveConflictSurfaceModel = AttendanceSurfaceBase &
  Readonly<{
    kind: "leave_conflict";
  }>;

export type AttendanceSurfaceModel =
  | AttendanceCreateSurfaceModel
  | AttendancePendingSurfaceModel
  | AttendanceReviewSurfaceModel
  | AttendanceLeaveConflictSurfaceModel;

export type AttendanceHistoryAction = AttendanceCreateSurfaceModel &
  Readonly<{
    label: string;
  }>;

export type AttendancePendingEditSurfaceModel = Omit<
  AttendancePendingSurfaceModel,
  "kind" | "title" | "description" | "ctaLabel"
> &
  Readonly<{
    ctaLabel: "변경 저장";
    kind: "pending_edit";
    title: "정정 요청을 수정할 수 있어요.";
    description: "검토 전에 내용을 수정하거나 철회할 수 있어요.";
  }>;

export type AttendanceReviewResubmitSurfaceModel = Omit<
  AttendanceReviewSurfaceModel,
  "kind" | "title" | "description" | "ctaLabel"
> &
  Readonly<{
    ctaLabel: "다시 제출";
    dateEditable: false;
    kind: "review_resubmit";
    title: "사유를 반영해서 다시 제출해 주세요.";
    description: "남긴 사유를 확인하고 필요한 내용을 보완해 다시 제출할 수 있어요.";
  }>;

export type AttendanceSheetState =
  | AttendanceSurfaceModel
  | AttendancePendingEditSurfaceModel
  | AttendanceReviewResubmitSurfaceModel;

function getPreferredClockInAt(
  record: AttendanceHistoryResponse["records"][number],
) {
  return (
    record.expectedWorkday.adjustedClockInAt ??
    record.expectedWorkday.expectedClockInAt
  );
}

function getPreferredClockOutAt(
  record: AttendanceHistoryResponse["records"][number],
) {
  return (
    record.expectedWorkday.adjustedClockOutAt ??
    record.expectedWorkday.expectedClockOutAt
  );
}

function getTodayPreferredClockInAt(today: AttendanceTodayResponse) {
  return (
    today.expectedWorkday.adjustedClockInAt ??
    today.expectedWorkday.expectedClockInAt
  );
}

function getTodayPreferredClockOutAt(today: AttendanceTodayResponse) {
  return (
    today.expectedWorkday.adjustedClockOutAt ??
    today.expectedWorkday.expectedClockOutAt
  );
}

function getLatestFailedAttempt(attempts: AttendanceAttempt[]) {
  return attempts.findLast((attempt) => attempt.status === "failed") ?? null;
}

function isCarryOverManualRequest(
  request: AttendanceSurfaceManualRequestResource | null,
  previousDayOpenRecord: PreviousDayOpenRecord | null,
) {
  return (
    request !== null &&
    previousDayOpenRecord !== null &&
    request.date === previousDayOpenRecord.date
  );
}

function buildCreateSurfaceModel(input: {
  ctaLabel: string;
  dateEditable?: boolean;
  draft: AttendanceManualRequestDraft;
  id: string;
  submitLabel?: string;
  title: string;
  description: string;
  tone?: AttendanceSurfaceTone;
}): AttendanceCreateSurfaceModel {
  return {
    ctaLabel: input.ctaLabel,
    dateEditable: input.dateEditable ?? true,
    description: input.description,
    draft: input.draft,
    id: input.id,
    kind: "create",
    submitLabel: input.submitLabel ?? "정정 요청 보내기",
    title: input.title,
    tone: input.tone ?? "default",
  };
}

function buildPendingSurfaceModel(input: {
  ctaLabel: string;
  draft: AttendanceManualRequestDraft;
  id: string;
  request: AttendanceSurfaceManualRequestResource;
  title: string;
  description: string;
  tone?: AttendanceSurfaceTone;
}): AttendancePendingSurfaceModel {
  return {
    ctaLabel: input.ctaLabel,
    dateEditable: input.request.parentRequestId === null,
    description: input.description,
    draft: input.draft,
    id: input.id,
    kind: "pending",
    request: input.request,
    title: input.title,
    tone: input.tone ?? "default",
  };
}

function buildReviewSurfaceModel(input: {
  ctaLabel: string;
  draft: AttendanceResubmissionDraft;
  id: string;
  request: AttendanceSurfaceManualRequestResource;
  submitLabel?: string;
  title: string;
  description: string;
  tone?: AttendanceSurfaceTone;
}): AttendanceReviewSurfaceModel {
  return {
    ctaLabel: input.ctaLabel,
    description: input.description,
    draft: input.draft,
    id: input.id,
    kind: "review",
    request: input.request,
    submitLabel: input.submitLabel ?? "다시 제출",
    title: input.title,
    tone: input.tone ?? "default",
  };
}

function buildRequestSurfaceModel(
  request: AttendanceSurfaceManualRequestResource,
  input: {
    id: string;
    pendingTitle: string;
    pendingDescription: string;
    reviewTone?: AttendanceSurfaceTone;
  },
): AttendancePendingSurfaceModel | AttendanceReviewSurfaceModel {
  if (request.status === "pending") {
    return buildPendingSurfaceModel({
      id: input.id,
      request,
      draft: buildRequestDraft(request),
      title: input.pendingTitle,
      description: input.pendingDescription,
      ctaLabel: "상태 확인",
    });
  }

  if (request.status === "revision_requested") {
    return buildReviewSurfaceModel({
      id: input.id,
      request,
      draft: buildResubmissionDraft(request),
      title: "보완이 필요해요.",
      description: "남긴 사유를 확인하고 수정해서 다시 제출해 주세요.",
      ctaLabel: "다시 제출",
      tone: input.reviewTone ?? "destructive",
    });
  }

  return buildReviewSurfaceModel({
    id: input.id,
    request,
    draft: buildResubmissionDraft(request),
    title: "조정이 필요해요.",
    description: "사유를 확인하고 수정해서 다시 제출할 수 있어요.",
    ctaLabel: "사유 확인",
    tone: input.reviewTone ?? "destructive",
  });
}

function buildFailedAttemptDraft(
  today: AttendanceTodayResponse,
  failedAttempt: Extract<AttendanceAttempt, { status: "failed" }>,
): AttendanceManualRequestDraft {
  if (
    failedAttempt.action === "clock_out" &&
    today.previousDayOpenRecord !== null &&
    failedAttempt.date === today.previousDayOpenRecord.date
  ) {
    return buildCarryOverDraft(today.previousDayOpenRecord);
  }

  if (failedAttempt.action === "clock_out") {
    return {
      date: failedAttempt.date,
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: getTodayPreferredClockOutAt(today),
      reason: "",
    };
  }

  return {
    date: failedAttempt.date,
    action: "clock_in",
    requestedClockInAt: getTodayPreferredClockInAt(today),
    requestedClockOutAt: null,
    reason: "",
  };
}

function buildFailedAttemptSurface(
  today: AttendanceTodayResponse,
  failedAttempt: Extract<AttendanceAttempt, { status: "failed" }>,
): AttendanceCreateSurfaceModel {
  const isClockOutFailure = failedAttempt.action === "clock_out";
  const isBeaconFailure = failedAttempt.failureReason
    .toLowerCase()
    .includes("beacon");

  return buildCreateSurfaceModel({
    id: `attempt-failed-${failedAttempt.id}`,
    draft: buildFailedAttemptDraft(today, failedAttempt),
    title: isClockOutFailure
      ? "퇴근 시도가 확인되지 않았어요."
      : isBeaconFailure
        ? "비콘을 찾을 수 없어요."
        : "출근 시도가 확인되지 않았어요.",
    description: isClockOutFailure
      ? "필요하면 퇴근 시간을 정정 요청할 수 있어요."
      : isBeaconFailure
        ? "비콘이 확인되면 출근할 수 있어요. 지금은 정정 요청으로 기록을 남길 수 있어요."
        : "출근 기록이 빠졌다면 정정 요청으로 확인할 수 있어요.",
    ctaLabel: isClockOutFailure ? "퇴근 시간 정정 요청" : "출근 기록 확인",
    tone: "destructive",
  });
}

export function buildCarryOverDraft(
  previousDayOpenRecord: PreviousDayOpenRecord,
): AttendanceManualRequestDraft {
  return {
    date: previousDayOpenRecord.date,
    action: "clock_out",
    requestedClockInAt: null,
    requestedClockOutAt: previousDayOpenRecord.expectedClockOutAt,
    reason: "",
  };
}

export function buildHistoryCorrectionDraft(
  record: AttendanceHistoryResponse["records"][number],
): AttendanceManualRequestDraft | null {
  if (record.record?.clockInAt && record.record.clockOutAt === null) {
    return {
      date: record.date,
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: getPreferredClockOutAt(record),
      reason: "",
    };
  }

  if (record.record === null) {
    return {
      date: record.date,
      action: "both",
      requestedClockInAt: getPreferredClockInAt(record),
      requestedClockOutAt: getPreferredClockOutAt(record),
      reason: "",
    };
  }

  return null;
}

export function buildRequestDraft(
  request: AttendanceSurfaceManualRequestResource,
): AttendanceManualRequestDraft {
  return {
    date: request.date,
    action: request.action,
    requestedClockInAt: request.requestedClockInAt,
    requestedClockOutAt: request.requestedClockOutAt,
    reason: request.reason,
  };
}

export function buildResubmissionDraft(
  request: AttendanceSurfaceManualRequestResource,
): AttendanceResubmissionDraft {
  return {
    ...buildRequestDraft(request),
    parentRequestId: request.id,
    followUpKind: "resubmission",
  };
}

export function buildExceptionSurfaceModels(
  today: AttendanceTodayResponse,
): AttendanceSurfaceModel[] {
  const surfaces: AttendanceSurfaceModel[] = [];
  const carryOverRequest = isCarryOverManualRequest(
    today.manualRequest,
    today.previousDayOpenRecord,
  )
    ? today.manualRequest
    : null;

  if (
    today.display.activeExceptions.includes("previous_day_checkout_missing") &&
    today.previousDayOpenRecord !== null
  ) {
    if (carryOverRequest !== null) {
      surfaces.push(
        buildRequestSurfaceModel(carryOverRequest, {
          id: "previous-day-checkout-missing",
          pendingTitle: "어제 퇴근 기록을 확인하고 있어요.",
          pendingDescription:
            "제출한 정정 요청의 진행 상태를 확인할 수 있어요.",
        }),
      );
    } else {
      surfaces.push(
        buildCreateSurfaceModel({
          id: "previous-day-checkout-missing",
          draft: buildCarryOverDraft(today.previousDayOpenRecord),
          title: "어제 퇴근 기록이 아직 없어요.",
          description: "이미 퇴근했다면 퇴근 시간을 정정 요청할 수 있어요.",
          ctaLabel: "어제 퇴근 시간 정정 요청",
          tone: "destructive",
        }),
      );
    }
  }

  if (today.display.activeExceptions.includes("attempt_failed")) {
    const latestFailedAttempt = getLatestFailedAttempt(today.attempts);

    if (latestFailedAttempt?.status === "failed") {
      surfaces.push(buildFailedAttemptSurface(today, latestFailedAttempt));
    }
  }

  if (
    today.manualRequest !== null &&
    carryOverRequest === null &&
    (today.display.activeExceptions.includes("manual_request_pending") ||
      today.display.activeExceptions.includes("manual_request_rejected"))
  ) {
    surfaces.push(
      buildRequestSurfaceModel(today.manualRequest, {
        id: "manual-request-summary",
        pendingTitle: "근태 정정 요청을 확인하고 있어요.",
        pendingDescription: "제출한 정정 요청의 진행 상태를 확인할 수 있어요.",
      }),
    );
  }

  if (today.display.activeExceptions.includes("leave_work_conflict")) {
    surfaces.push({
      id: "leave-work-conflict",
      kind: "leave_conflict",
      title: "휴가 일정과 실제 근무 기록이 함께 있어요.",
      description: "휴가 상태와 근무 기록을 함께 확인해 주세요.",
      ctaLabel: "충돌 확인",
      tone: "destructive",
    });
  }

  if (today.display.activeExceptions.includes("not_checked_in")) {
    surfaces.push(
      buildCreateSurfaceModel({
        id: "not-checked-in",
        draft: {
          date: today.date,
          action: "clock_in",
          requestedClockInAt: getTodayPreferredClockInAt(today),
          requestedClockOutAt: null,
          reason: "",
        },
        title: "오늘 출근 기록이 아직 없어요.",
        description: "출근이 늦어졌거나 기록이 빠졌다면 확인해 주세요.",
        ctaLabel: "출근 기록 확인",
        tone: "destructive",
      }),
    );
  }

  if (today.display.activeExceptions.includes("absent")) {
    surfaces.push(
      buildCreateSurfaceModel({
        id: "absent",
        draft: {
          date: today.date,
          action: "both",
          requestedClockInAt: getTodayPreferredClockInAt(today),
          requestedClockOutAt: getTodayPreferredClockOutAt(today),
          reason: "",
        },
        title: "오늘 근무 기록이 비어 있어요.",
        description: "출근과 퇴근 시간이 모두 빠졌다면 정정 요청해 주세요.",
        ctaLabel: "근무 기록 정정",
        tone: "destructive",
      }),
    );
  }

  return surfaces;
}

export function buildHistoryAction(
  record: AttendanceHistoryResponse["records"][number],
): AttendanceHistoryAction | null {
  const draft = buildHistoryCorrectionDraft(record);

  if (draft === null) {
    return null;
  }

  if (draft.action === "clock_out") {
    return {
      ...buildCreateSurfaceModel({
        id: `history-${record.date}`,
        draft,
        title: "퇴근 기록을 정정할 수 있어요.",
        description: "빠진 퇴근 시간을 확인해서 정정 요청할 수 있어요.",
        ctaLabel: "퇴근 정정",
        tone: "default",
      }),
      label: "퇴근 정정",
    };
  }

  return {
    ...buildCreateSurfaceModel({
      id: `history-${record.date}`,
      draft,
      title: "근무 기록을 정정할 수 있어요.",
      description:
        "빠진 근무 기록이 있다면 출근과 퇴근 시간을 함께 남겨 주세요.",
      ctaLabel: "정정 요청",
      tone: "default",
    }),
    label: "정정 요청",
  };
}

export function toPendingEditSurfaceModel(
  surface: AttendancePendingSurfaceModel,
): AttendancePendingEditSurfaceModel {
  return {
    ...surface,
    ctaLabel: "변경 저장",
    description: "검토 전에 내용을 수정하거나 철회할 수 있어요.",
    kind: "pending_edit",
    title: "정정 요청을 수정할 수 있어요.",
  };
}

export function toReviewResubmitSurfaceModel(
  surface: AttendanceReviewSurfaceModel,
): AttendanceReviewResubmitSurfaceModel {
  return {
    ...surface,
    ctaLabel: "다시 제출",
    dateEditable: false,
    description:
      "남긴 사유를 확인하고 필요한 내용을 보완해 다시 제출할 수 있어요.",
    kind: "review_resubmit",
    title: "사유를 반영해서 다시 제출해 주세요.",
  };
}
