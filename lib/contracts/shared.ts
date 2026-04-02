import { z } from "zod";

export const apiDateSchema = z.iso.date();
export const apiDateTimeSchema = z.iso.datetime({ offset: true });

export const attendancePhaseSchema = z.enum([
  "non_workday",
  "before_check_in",
  "working",
  "checked_out",
]);
export const attendanceFlagSchema = z.enum(["late", "early_leave"]);
export const attendanceAttemptActionSchema = z.enum(["clock_in", "clock_out"]);
export const attendanceAttemptStatusSchema = z.enum(["success", "failed"]);
export const attendanceExceptionTypeSchema = z.enum([
  "attempt_failed",
  "not_checked_in",
  "absent",
  "previous_day_checkout_missing",
  "leave_work_conflict",
  "manual_request_pending",
  "manual_request_rejected",
]);
export const nextActionTypeSchema = z.enum([
  "clock_in",
  "clock_out",
  "submit_manual_request",
  "resolve_previous_day_checkout",
  "review_request_status",
  "review_leave_conflict",
  "wait",
]);
export const attendanceRecordSourceSchema = z.enum(["beacon", "manual"]);

export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const requestStatusSchema = z.enum([
  "pending",
  "revision_requested",
  "withdrawn",
  "approved",
  "rejected",
]);
export const manualAttendanceActionSchema = z.enum([
  "clock_in",
  "clock_out",
  "both",
]);
export const leaveTypeSchema = z.enum([
  "annual",
  "half_am",
  "half_pm",
  "hourly",
]);
export const requestTypeSchema = z.enum(["manual_attendance", "leave"]);
export const followUpKindSchema = z.enum(["resubmission", "change", "cancel"]);
export const requestNextActionSchema = z.enum(["admin_review", "none"]);
export const errorCodeSchema = z.enum([
  "validation_error",
  "conflict",
  "not_found",
]);

export const employeeSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
});

export const leaveCoverageSchema = z.object({
  requestId: z.string().min(1),
  leaveType: leaveTypeSchema,
  startAt: apiDateTimeSchema,
  endAt: apiDateTimeSchema,
});

export const expectedWorkdaySchema = z.object({
  isWorkday: z.boolean(),
  expectedClockInAt: apiDateTimeSchema.nullable(),
  expectedClockOutAt: apiDateTimeSchema.nullable(),
  adjustedClockInAt: apiDateTimeSchema.nullable(),
  adjustedClockOutAt: apiDateTimeSchema.nullable(),
  countsTowardAdminSummary: z.boolean(),
  leaveCoverage: leaveCoverageSchema.nullable(),
});

const attendanceAttemptBaseSchema = z.object({
  id: z.string().min(1),
  date: apiDateSchema,
  action: attendanceAttemptActionSchema,
  attemptedAt: apiDateTimeSchema,
});

export const successfulAttendanceAttemptSchema =
  attendanceAttemptBaseSchema.extend({
    status: z.literal("success"),
    failureReason: z.null(),
  });

export const failedAttendanceAttemptSchema = attendanceAttemptBaseSchema.extend(
  {
    status: z.literal("failed"),
    failureReason: z.string().min(1),
  },
);

export const attendanceAttemptSchema = z.discriminatedUnion("status", [
  successfulAttendanceAttemptSchema,
  failedAttendanceAttemptSchema,
]);

export const attendanceRecordSchema = z.object({
  id: z.string().min(1),
  date: apiDateSchema,
  clockInAt: apiDateTimeSchema.nullable(),
  clockInSource: attendanceRecordSourceSchema.nullable(),
  clockOutAt: apiDateTimeSchema.nullable(),
  clockOutSource: attendanceRecordSourceSchema.nullable(),
  workMinutes: z.number().nullable(),
});

export const attendanceDisplayNextActionSchema = z.object({
  type: nextActionTypeSchema,
  relatedRequestId: z.string().min(1).nullable(),
});

export const attendanceDisplaySchema = z.object({
  phase: attendancePhaseSchema,
  flags: z.array(attendanceFlagSchema),
  activeExceptions: z.array(attendanceExceptionTypeSchema),
  nextAction: attendanceDisplayNextActionSchema,
});

export const previousDayOpenRecordSchema = z.object({
  date: apiDateSchema,
  clockInAt: apiDateTimeSchema,
  clockOutAt: apiDateTimeSchema.nullable(),
  expectedClockOutAt: apiDateTimeSchema.nullable(),
});

export const leaveBalanceSchema = z.object({
  totalDays: z.number(),
  usedDays: z.number(),
  remainingDays: z.number(),
});

export const pendingApprovalStateSchema = z.object({
  status: z.literal("pending"),
  reviewedAt: apiDateTimeSchema.nullable(),
  rejectionReason: z.null(),
});

export const approvedApprovalStateSchema = z.object({
  status: z.literal("approved"),
  reviewedAt: apiDateTimeSchema.nullable(),
  rejectionReason: z.null(),
});

export const rejectedApprovalStateSchema = z.object({
  status: z.literal("rejected"),
  reviewedAt: apiDateTimeSchema.nullable(),
  rejectionReason: z.string().trim().min(1),
});

const leaveRequestBaseSchema = z.object({
  id: z.string().min(1),
  requestType: z.literal("leave"),
  date: apiDateSchema,
  reason: z.string().min(1),
  requestedAt: apiDateTimeSchema,
});

const hourlyLeaveRequestBaseSchema = leaveRequestBaseSchema.extend({
  leaveType: z.literal("hourly"),
  hours: z.number(),
});

const nonHourlyLeaveRequestBaseSchema = leaveRequestBaseSchema.extend({
  leaveType: leaveTypeSchema.exclude(["hourly"]),
  hours: z.null(),
});

export const leaveRequestSchema = z.union([
  hourlyLeaveRequestBaseSchema.merge(pendingApprovalStateSchema),
  hourlyLeaveRequestBaseSchema.merge(approvedApprovalStateSchema),
  hourlyLeaveRequestBaseSchema.merge(rejectedApprovalStateSchema),
  nonHourlyLeaveRequestBaseSchema.merge(pendingApprovalStateSchema),
  nonHourlyLeaveRequestBaseSchema.merge(approvedApprovalStateSchema),
  nonHourlyLeaveRequestBaseSchema.merge(rejectedApprovalStateSchema),
]);

const requestChainProjectionBaseSchema = z.object({
  activeRequestId: z.string().min(1).nullable(),
  activeStatus: requestStatusSchema.nullable(),
  effectiveRequestId: z.string().min(1),
  effectiveStatus: requestStatusSchema,
  governingReviewComment: z.string().trim().min(1).nullable(),
  hasActiveFollowUp: z.boolean(),
  nextAction: requestNextActionSchema,
});

function validateRequestChainProjection(
  value: z.infer<typeof requestChainProjectionBaseSchema>,
  ctx: z.RefinementCtx,
) {
  const hasActiveRequestId = value.activeRequestId !== null;
  const hasActiveStatus = value.activeStatus !== null;
  const hasActiveRequest = hasActiveRequestId && hasActiveStatus;

  if (hasActiveRequestId && !hasActiveStatus) {
    ctx.addIssue({
      code: "custom",
      path: ["activeStatus"],
      message:
        'Invalid input: "activeStatus" is required when "activeRequestId" is present',
    });
  }

  if (!hasActiveRequestId && hasActiveStatus) {
    ctx.addIssue({
      code: "custom",
      path: ["activeRequestId"],
      message:
        'Invalid input: "activeRequestId" is required when "activeStatus" is present',
    });
  }

  if (value.hasActiveFollowUp && !hasActiveRequest) {
    ctx.addIssue({
      code: "custom",
      path: ["hasActiveFollowUp"],
      message:
        'Invalid input: "hasActiveFollowUp" requires both "activeRequestId" and "activeStatus"',
    });
  }

  if (value.activeStatus !== null && value.activeStatus !== "pending") {
    ctx.addIssue({
      code: "custom",
      path: ["activeStatus"],
      message:
        'Invalid input: "activeStatus" must be "pending" when active work exists',
    });
  }

  if (hasActiveRequest && value.effectiveRequestId !== value.activeRequestId) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveRequestId"],
      message:
        'Invalid input: "effectiveRequestId" must match "activeRequestId" when active work exists',
    });
  }

  if (hasActiveRequest && value.effectiveStatus !== value.activeStatus) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveStatus"],
      message:
        'Invalid input: "effectiveStatus" must match "activeStatus" when active work exists',
    });
  }

  if (hasActiveRequest && value.nextAction !== "admin_review") {
    ctx.addIssue({
      code: "custom",
      path: ["nextAction"],
      message:
        'Invalid input: "nextAction" must be "admin_review" when active work exists',
    });
  }

  if (!hasActiveRequest && value.nextAction !== "none") {
    ctx.addIssue({
      code: "custom",
      path: ["nextAction"],
      message:
        'Invalid input: "nextAction" must be "none" when no active work exists',
    });
  }
}

const manualAttendanceRequestResourceBaseSchema = z
  .object({
    id: z.string().min(1),
    requestType: z.literal("manual_attendance"),
    action: manualAttendanceActionSchema,
    date: apiDateSchema,
    requestedAt: apiDateTimeSchema,
    reason: z.string().min(1),
    status: requestStatusSchema,
    reviewedAt: apiDateTimeSchema.nullable(),
    reviewComment: z.string().trim().min(1).nullable(),
    rootRequestId: z.string().min(1),
    parentRequestId: z.string().min(1).nullable(),
    followUpKind: followUpKindSchema.extract(["resubmission"]).nullable(),
    supersededByRequestId: z.string().min(1).nullable(),
  })
  .merge(requestChainProjectionBaseSchema);

function validateManualAttendanceReviewState(
  value: z.infer<typeof manualAttendanceRequestResourceBaseSchema>,
  ctx: z.RefinementCtx,
) {
  const requiresReviewedAt =
    value.status === "approved" ||
    value.status === "rejected" ||
    value.status === "revision_requested";
  const requiresReviewComment =
    value.status === "rejected" || value.status === "revision_requested";

  if (requiresReviewedAt && value.reviewedAt === null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewedAt"],
      message:
        'Invalid input: "reviewedAt" is required for approved or reviewed manual attendance requests',
    });
  }

  if (!requiresReviewedAt && value.reviewedAt !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewedAt"],
      message:
        'Invalid input: "reviewedAt" must be null for unreviewed manual attendance requests',
    });
  }

  if (requiresReviewComment && value.reviewComment === null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message:
        'Invalid input: "reviewComment" is required for rejected or revision-requested manual attendance requests',
    });
  }

  if (!requiresReviewComment && value.reviewComment !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message:
        'Invalid input: "reviewComment" must be null unless the manual attendance request is rejected or revision_requested',
    });
  }
}

function validateManualAttendanceRelations(
  value: z.infer<typeof manualAttendanceRequestResourceBaseSchema>,
  ctx: z.RefinementCtx,
) {
  const hasParentRequestId = value.parentRequestId !== null;
  const hasFollowUpKind = value.followUpKind !== null;

  if (hasParentRequestId && !hasFollowUpKind) {
    ctx.addIssue({
      code: "custom",
      path: ["followUpKind"],
      message:
        'Invalid input: "followUpKind" is required when "parentRequestId" is present',
    });
  }

  if (!hasParentRequestId && hasFollowUpKind) {
    ctx.addIssue({
      code: "custom",
      path: ["parentRequestId"],
      message:
        'Invalid input: "parentRequestId" is required when "followUpKind" is present',
    });
  }

  if (!hasParentRequestId && value.rootRequestId !== value.id) {
    ctx.addIssue({
      code: "custom",
      path: ["rootRequestId"],
      message:
        'Invalid input: "rootRequestId" must equal "id" for a root manual attendance request',
    });
  }

  if (hasParentRequestId && value.rootRequestId === value.id) {
    ctx.addIssue({
      code: "custom",
      path: ["rootRequestId"],
      message:
        'Invalid input: "rootRequestId" must point to the root request, not the current follow-up request',
    });
  }
}

export const requestChainProjectionSchema =
  requestChainProjectionBaseSchema.superRefine(validateRequestChainProjection);

export const manualAttendanceRequestResourceSchema =
  manualAttendanceRequestResourceBaseSchema.superRefine((value, ctx) => {
    validateRequestChainProjection(value, ctx);
    validateManualAttendanceReviewState(value, ctx);
    validateManualAttendanceRelations(value, ctx);
  });

const attendanceSurfaceManualRequestStatusSchema = requestStatusSchema.extract([
  "pending",
  "revision_requested",
  "rejected",
]);

export const attendanceSurfaceManualRequestResourceSchema =
  manualAttendanceRequestResourceBaseSchema
    .extend({
      status: attendanceSurfaceManualRequestStatusSchema,
      activeStatus: requestStatusSchema.extract(["pending"]).nullable(),
      effectiveStatus: attendanceSurfaceManualRequestStatusSchema,
    })
    .superRefine((value, ctx) => {
      validateRequestChainProjection(value, ctx);
      validateManualAttendanceReviewState(value, ctx);
      validateManualAttendanceRelations(value, ctx);
    });

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
  }),
});

export type ApiDate = z.infer<typeof apiDateSchema>;
export type ApiDateTime = z.infer<typeof apiDateTimeSchema>;
export type AttendancePhase = z.infer<typeof attendancePhaseSchema>;
export type AttendanceFlag = z.infer<typeof attendanceFlagSchema>;
export type AttendanceAttemptAction = z.infer<
  typeof attendanceAttemptActionSchema
>;
export type AttendanceAttemptStatus = z.infer<
  typeof attendanceAttemptStatusSchema
>;
export type AttendanceExceptionType = z.infer<
  typeof attendanceExceptionTypeSchema
>;
export type NextActionType = z.infer<typeof nextActionTypeSchema>;
export type AttendanceRecordSource = z.infer<
  typeof attendanceRecordSourceSchema
>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type ManualAttendanceAction = z.infer<
  typeof manualAttendanceActionSchema
>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type RequestType = z.infer<typeof requestTypeSchema>;
export type FollowUpKind = z.infer<typeof followUpKindSchema>;
export type RequestNextAction = z.infer<typeof requestNextActionSchema>;
export type EmployeeSummary = z.infer<typeof employeeSummarySchema>;
export type LeaveCoverage = z.infer<typeof leaveCoverageSchema>;
export type ExpectedWorkday = z.infer<typeof expectedWorkdaySchema>;
export type AttendanceAttempt = z.infer<typeof attendanceAttemptSchema>;
export type SuccessfulAttendanceAttempt = z.infer<
  typeof successfulAttendanceAttemptSchema
>;
export type FailedAttendanceAttempt = z.infer<
  typeof failedAttendanceAttemptSchema
>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceDisplayNextAction = z.infer<
  typeof attendanceDisplayNextActionSchema
>;
export type AttendanceDisplay = z.infer<typeof attendanceDisplaySchema>;
export type PreviousDayOpenRecord = z.infer<typeof previousDayOpenRecordSchema>;
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type RequestChainProjection = z.infer<
  typeof requestChainProjectionSchema
>;
export type ManualAttendanceRequestResource = z.infer<
  typeof manualAttendanceRequestResourceSchema
>;
export type AttendanceSurfaceManualRequestResource = z.infer<
  typeof attendanceSurfaceManualRequestResourceSchema
>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
