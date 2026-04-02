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

export const requestStatusSchema = z.enum([
  "pending",
  "revision_requested",
  "withdrawn",
  "approved",
  "rejected",
]);
export const requestReviewDecisionSchema = z.enum([
  "approve",
  "reject",
  "request_revision",
]);
export const requestQueueViewSchema = z.enum([
  "needs_review",
  "completed",
  "all",
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

export const companyEventSchema = z.object({
  id: z.string().min(1),
  date: apiDateSchema,
  title: z.string().min(1),
});

const leaveConflictContextItemSchema = z.object({}).passthrough();

export const leaveConflictSchema = z.object({
  companyEventContext: z.array(companyEventSchema),
  effectiveApprovedLeaveContext: z.array(leaveConflictContextItemSchema),
  pendingLeaveContext: z.array(leaveConflictContextItemSchema),
  staffingRisk: z.string().min(1),
  requiresApprovalConfirmation: z.boolean(),
});

export const requestReviewStateFieldsSchema = z.object({
  status: requestStatusSchema,
  reviewedAt: apiDateTimeSchema.nullable(),
  reviewComment: z.string().trim().min(1).nullable(),
});

export const requestRelationFieldsSchema = z.object({
  rootRequestId: z.string().min(1),
  parentRequestId: z.string().min(1).nullable(),
  followUpKind: followUpKindSchema.nullable(),
  supersededByRequestId: z.string().min(1).nullable(),
});

export const requestChainProjectionFieldsSchema = z.object({
  activeRequestId: z.string().min(1).nullable(),
  activeStatus: requestStatusSchema.nullable(),
  effectiveRequestId: z.string().min(1),
  effectiveStatus: requestStatusSchema,
  governingReviewComment: z.string().trim().min(1).nullable(),
  hasActiveFollowUp: z.boolean(),
  nextAction: requestNextActionSchema,
});

function hasValue(value: string | null | undefined) {
  return value !== null && value !== undefined;
}

export function validateRequestChainProjection(
  value: z.infer<typeof requestChainProjectionFieldsSchema>,
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

  if (
    hasActiveRequest &&
    value.effectiveStatus === "pending" &&
    value.effectiveRequestId !== value.activeRequestId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveRequestId"],
      message:
        'Invalid input: "effectiveRequestId" must match "activeRequestId" when the effective status is "pending"',
    });
  }

  if (
    hasActiveRequest &&
    value.effectiveStatus === "pending" &&
    value.effectiveStatus !== value.activeStatus
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveStatus"],
      message:
        'Invalid input: "effectiveStatus" must match "activeStatus" when the effective status is "pending"',
    });
  }

  if (
    hasActiveRequest &&
    value.effectiveStatus !== "pending" &&
    value.effectiveStatus !== "approved"
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveStatus"],
      message:
        'Invalid input: "effectiveStatus" must stay "pending" or "approved" when active work exists',
    });
  }

  if (hasActiveRequest && value.effectiveStatus === "approved") {
    if (!value.hasActiveFollowUp) {
      ctx.addIssue({
        code: "custom",
        path: ["hasActiveFollowUp"],
        message:
          'Invalid input: "hasActiveFollowUp" must be true when approved work remains effective during an active request',
      });
    }

    if (value.effectiveRequestId === value.activeRequestId) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveRequestId"],
        message:
          'Invalid input: "effectiveRequestId" must differ from "activeRequestId" when approved work remains effective during an active request',
      });
    }
  }

  if (!hasActiveRequest && value.effectiveStatus === "pending") {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveStatus"],
      message:
        'Invalid input: "effectiveStatus" cannot be "pending" when no active work exists',
    });
  }

  if (
    hasActiveRequest &&
    value.effectiveStatus === "approved" &&
    value.governingReviewComment !== null
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["governingReviewComment"],
      message:
        'Invalid input: "governingReviewComment" must be null while approved work remains effective during active follow-up review',
    });
  }

  if (
    (value.effectiveStatus === "rejected" ||
      value.effectiveStatus === "revision_requested") &&
    value.governingReviewComment === null
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["governingReviewComment"],
      message:
        'Invalid input: "governingReviewComment" is required when "effectiveStatus" is "rejected" or "revision_requested"',
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

export function validateRequestReviewState(
  value: z.infer<typeof requestReviewStateFieldsSchema>,
  ctx: z.RefinementCtx,
  resourceLabel: string,
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
      message: `Invalid input: "reviewedAt" is required for reviewed ${resourceLabel}`,
    });
  }

  if (!requiresReviewedAt && value.reviewedAt !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewedAt"],
      message: `Invalid input: "reviewedAt" must be null for unreviewed ${resourceLabel}`,
    });
  }

  if (requiresReviewComment && value.reviewComment === null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message: `Invalid input: "reviewComment" is required for non-approved reviewed ${resourceLabel}`,
    });
  }

  if (!requiresReviewComment && value.reviewComment !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message: `Invalid input: "reviewComment" must be null unless the ${resourceLabel} is rejected or revision_requested`,
    });
  }
}

export function validateRequestRelations(
  value: z.infer<typeof requestRelationFieldsSchema> & { id: string },
  ctx: z.RefinementCtx,
  resourceLabel: string,
) {
  const hasParentRequestId = hasValue(value.parentRequestId);
  const hasFollowUpKind = hasValue(value.followUpKind);

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

  if (hasParentRequestId && value.parentRequestId === value.id) {
    ctx.addIssue({
      code: "custom",
      path: ["parentRequestId"],
      message:
        'Invalid input: "parentRequestId" must not reference the current request',
    });
  }

  if (!hasParentRequestId && value.rootRequestId !== value.id) {
    ctx.addIssue({
      code: "custom",
      path: ["rootRequestId"],
      message: `Invalid input: "rootRequestId" must equal "id" for a root ${resourceLabel}`,
    });
  }

  if (hasParentRequestId && value.rootRequestId === value.id) {
    ctx.addIssue({
      code: "custom",
      path: ["rootRequestId"],
      message: `Invalid input: "rootRequestId" must point to the root ${resourceLabel}, not the current follow-up request`,
    });
  }
}

function validateManualAttendanceRequestedClockFields(
  value: {
    action: z.infer<typeof manualAttendanceActionSchema>;
    requestedClockInAt: z.infer<typeof apiDateTimeSchema> | null;
    requestedClockOutAt: z.infer<typeof apiDateTimeSchema> | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.action === "clock_in") {
    if (value.requestedClockInAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockInAt"],
        message:
          'Invalid input: "requestedClockInAt" is required when "action" is "clock_in"',
      });
    }

    if (value.requestedClockOutAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockOutAt"],
        message:
          'Invalid input: "requestedClockOutAt" must be null when "action" is "clock_in"',
      });
    }
  }

  if (value.action === "clock_out") {
    if (value.requestedClockOutAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockOutAt"],
        message:
          'Invalid input: "requestedClockOutAt" is required when "action" is "clock_out"',
      });
    }

    if (value.requestedClockInAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockInAt"],
        message:
          'Invalid input: "requestedClockInAt" must be null when "action" is "clock_out"',
      });
    }
  }

  if (value.action === "both") {
    if (value.requestedClockInAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockInAt"],
        message:
          'Invalid input: "requestedClockInAt" is required when "action" is "both"',
      });
    }

    if (value.requestedClockOutAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockOutAt"],
        message:
          'Invalid input: "requestedClockOutAt" is required when "action" is "both"',
      });
    }
  }
}

function validateManualAttendanceChainProjection(
  value: {
    activeRequestId: string | null;
    effectiveStatus: z.infer<typeof requestStatusSchema>;
  },
  ctx: z.RefinementCtx,
) {
  if (value.activeRequestId !== null && value.effectiveStatus === "approved") {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveStatus"],
      message:
        "Invalid input: manual attendance requests cannot keep approved work effective while active work exists",
    });
  }
}

function validateLeaveRequestTiming(
  value: {
    leaveType: z.infer<typeof leaveTypeSchema>;
    startAt: z.infer<typeof apiDateTimeSchema> | null;
    endAt: z.infer<typeof apiDateTimeSchema> | null;
    hours: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.leaveType === "hourly") {
    if (value.startAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["startAt"],
        message:
          'Invalid input: "startAt" is required when "leaveType" is "hourly"',
      });
    }

    if (value.endAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message:
          'Invalid input: "endAt" is required when "leaveType" is "hourly"',
      });
    }

    if (value.hours === null) {
      ctx.addIssue({
        code: "custom",
        path: ["hours"],
        message:
          'Invalid input: "hours" is required output when "leaveType" is "hourly"',
      });
    }
  }

  if (value.leaveType !== "hourly") {
    if (value.startAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["startAt"],
        message:
          'Invalid input: "startAt" must be null unless "leaveType" is "hourly"',
      });
    }

    if (value.endAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message:
          'Invalid input: "endAt" must be null unless "leaveType" is "hourly"',
      });
    }

    if (value.hours !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["hours"],
        message:
          'Invalid input: "hours" must be null unless "leaveType" is "hourly"',
      });
    }
  }
}

export const requestChainProjectionSchema =
  requestChainProjectionFieldsSchema.superRefine(
    validateRequestChainProjection,
  );

const manualAttendanceRequestRelationFieldsSchema =
  requestRelationFieldsSchema.extend({
    followUpKind: followUpKindSchema.extract(["resubmission"]).nullable(),
  });

const manualAttendanceRequestResourceBaseSchema = z
  .object({
    id: z.string().min(1),
    requestType: z.literal("manual_attendance"),
    action: manualAttendanceActionSchema,
    date: apiDateSchema,
    submittedAt: apiDateTimeSchema,
    requestedClockInAt: apiDateTimeSchema.nullable(),
    requestedClockOutAt: apiDateTimeSchema.nullable(),
    reason: z.string().min(1),
  })
  .merge(requestReviewStateFieldsSchema)
  .merge(manualAttendanceRequestRelationFieldsSchema)
  .merge(requestChainProjectionFieldsSchema);

export const manualAttendanceRequestResourceSchema =
  manualAttendanceRequestResourceBaseSchema.superRefine((value, ctx) => {
    validateManualAttendanceRequestedClockFields(value, ctx);
    validateRequestReviewState(value, ctx, "manual attendance request");
    validateRequestRelations(value, ctx, "manual attendance request");
    validateRequestChainProjection(value, ctx);
    validateManualAttendanceChainProjection(value, ctx);
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
      validateManualAttendanceRequestedClockFields(value, ctx);
      validateRequestReviewState(value, ctx, "manual attendance request");
      validateRequestRelations(value, ctx, "manual attendance request");
      validateRequestChainProjection(value, ctx);
      validateManualAttendanceChainProjection(value, ctx);
    });

const leaveRequestResourceBaseSchema = z
  .object({
    id: z.string().min(1),
    requestType: z.literal("leave"),
    leaveType: leaveTypeSchema,
    date: apiDateSchema,
    startAt: apiDateTimeSchema.nullable(),
    endAt: apiDateTimeSchema.nullable(),
    hours: z.number().nullable(),
    reason: z.string().min(1),
    requestedAt: apiDateTimeSchema,
    leaveConflict: leaveConflictSchema.optional(),
  })
  .merge(requestReviewStateFieldsSchema)
  .merge(requestRelationFieldsSchema)
  .merge(requestChainProjectionFieldsSchema);

export const leaveRequestSchema = leaveRequestResourceBaseSchema.superRefine(
  (value, ctx) => {
    validateLeaveRequestTiming(value, ctx);
    validateRequestReviewState(value, ctx, "leave request");
    validateRequestRelations(value, ctx, "leave request");
    validateRequestChainProjection(value, ctx);
  },
);

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
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type RequestReviewDecision = z.infer<typeof requestReviewDecisionSchema>;
export type RequestQueueView = z.infer<typeof requestQueueViewSchema>;
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
export type CompanyEvent = z.infer<typeof companyEventSchema>;
export type LeaveConflict = z.infer<typeof leaveConflictSchema>;
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
