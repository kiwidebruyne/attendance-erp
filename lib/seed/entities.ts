import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  attendanceAttemptActionSchema,
  attendanceAttemptStatusSchema,
  attendanceRecordSourceSchema,
  followUpKindSchema,
  leaveTypeSchema,
  manualAttendanceActionSchema,
  requestReviewDecisionSchema,
  requestStatusSchema,
} from "@/lib/contracts/shared";

export const employeeRoleSchema = z.enum(["employee", "admin"]);

export const employeeEntitySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  role: employeeRoleSchema,
});

export const expectedWorkdayEntitySchema = z.strictObject({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  date: apiDateSchema,
  isWorkday: z.boolean(),
  expectedClockInAt: apiDateTimeSchema.nullable(),
  expectedClockOutAt: apiDateTimeSchema.nullable(),
  adjustedClockInAt: apiDateTimeSchema.nullable(),
  adjustedClockOutAt: apiDateTimeSchema.nullable(),
  countsTowardAdminSummary: z.boolean(),
});

export const attendanceAttemptEntitySchema = z
  .strictObject({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    date: apiDateSchema,
    action: attendanceAttemptActionSchema,
    attemptedAt: apiDateTimeSchema,
    status: attendanceAttemptStatusSchema,
    failureReason: z.string().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "success" && value.failureReason !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["failureReason"],
        message:
          'Invalid input: "failureReason" must be null when the attempt status is "success"',
      });
    }

    if (value.status === "failed" && value.failureReason === null) {
      ctx.addIssue({
        code: "custom",
        path: ["failureReason"],
        message:
          'Invalid input: "failureReason" is required when the attempt status is "failed"',
      });
    }
  });

export const attendanceRecordEntitySchema = z.strictObject({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  date: apiDateSchema,
  clockInAt: apiDateTimeSchema.nullable(),
  clockInSource: attendanceRecordSourceSchema.nullable(),
  clockOutAt: apiDateTimeSchema.nullable(),
  clockOutSource: attendanceRecordSourceSchema.nullable(),
  workMinutes: z.number().int().nonnegative().nullable(),
  manualRequestId: z.string().min(1).nullable(),
});

const requestReviewStateEntitySchema = z.object({
  status: requestStatusSchema,
  reviewedAt: apiDateTimeSchema.nullable(),
  reviewComment: z.string().min(1).nullable(),
});

const requestRelationEntitySchema = z.object({
  rootRequestId: z.string().min(1),
  parentRequestId: z.string().min(1).nullable(),
  followUpKind: followUpKindSchema.nullable(),
  supersededByRequestId: z.string().min(1).nullable(),
});

function validateRequestLifecycleFields(
  value: {
    status: z.infer<typeof requestStatusSchema>;
    reviewedAt: z.infer<typeof apiDateTimeSchema> | null;
    reviewComment: string | null;
  },
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
        'Invalid input: "reviewedAt" is required for reviewed request entities',
    });
  }

  if (!requiresReviewedAt && value.reviewedAt !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewedAt"],
      message:
        'Invalid input: "reviewedAt" must be null unless the request is approved, rejected, or revision_requested',
    });
  }

  if (requiresReviewComment && value.reviewComment === null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message:
        'Invalid input: "reviewComment" is required when the request is rejected or revision_requested',
    });
  }

  if (!requiresReviewComment && value.reviewComment !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message:
        'Invalid input: "reviewComment" must be null unless the request is rejected or revision_requested',
    });
  }
}

export const requestReviewEventEntitySchema = z
  .strictObject({
    id: z.string().min(1),
    requestId: z.string().min(1),
    decision: requestReviewDecisionSchema,
    reviewComment: z.string().min(1).nullable(),
    reviewedAt: apiDateTimeSchema,
    reviewerId: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "approve" && value.reviewComment !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewComment"],
        message:
          'Invalid input: "reviewComment" must be null when the review decision is "approve"',
      });
    }

    if (value.decision !== "approve" && value.reviewComment === null) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewComment"],
        message:
          'Invalid input: "reviewComment" is required when the review decision is not "approve"',
      });
    }
  });

export const companyEventEntitySchema = z.strictObject({
  id: z.string().min(1),
  date: apiDateSchema,
  title: z.string().min(1),
});

export const manualAttendanceRequestEntitySchema = z
  .strictObject({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    requestType: z.literal("manual_attendance"),
    action: manualAttendanceActionSchema,
    date: apiDateSchema,
    submittedAt: apiDateTimeSchema,
    requestedClockInAt: apiDateTimeSchema.nullable(),
    requestedClockOutAt: apiDateTimeSchema.nullable(),
    reason: z.string().min(1),
    ...requestReviewStateEntitySchema.shape,
    ...requestRelationEntitySchema.shape,
  })
  .superRefine((value, ctx) => {
    validateRequestLifecycleFields(value, ctx);

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
          'Invalid input: "rootRequestId" must point to the root manual attendance request',
      });
    }

    if (value.followUpKind !== null && value.followUpKind !== "resubmission") {
      ctx.addIssue({
        code: "custom",
        path: ["followUpKind"],
        message:
          'Invalid input: "followUpKind" must be null or "resubmission" for manual attendance requests',
      });
    }
  });

export const leaveRequestEntitySchema = z
  .strictObject({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    requestType: z.literal("leave"),
    leaveType: leaveTypeSchema,
    date: apiDateSchema,
    startAt: apiDateTimeSchema.nullable(),
    endAt: apiDateTimeSchema.nullable(),
    reason: z.string().min(1),
    requestedAt: apiDateTimeSchema,
    ...requestReviewStateEntitySchema.shape,
    ...requestRelationEntitySchema.shape,
  })
  .superRefine((value, ctx) => {
    validateRequestLifecycleFields(value, ctx);

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
    }

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
          'Invalid input: "rootRequestId" must equal "id" for a root leave request',
      });
    }

    if (hasParentRequestId && value.rootRequestId === value.id) {
      ctx.addIssue({
        code: "custom",
        path: ["rootRequestId"],
        message:
          'Invalid input: "rootRequestId" must point to the root leave request',
      });
    }
  });

export type EmployeeEntity = z.infer<typeof employeeEntitySchema>;
export type ExpectedWorkdayEntity = z.infer<typeof expectedWorkdayEntitySchema>;
export type AttendanceAttemptEntity = z.infer<
  typeof attendanceAttemptEntitySchema
>;
export type AttendanceRecordEntity = z.infer<
  typeof attendanceRecordEntitySchema
>;
export type RequestReviewEventEntity = z.infer<
  typeof requestReviewEventEntitySchema
>;
export type CompanyEventEntity = z.infer<typeof companyEventEntitySchema>;
export type ManualAttendanceRequestEntity = z.infer<
  typeof manualAttendanceRequestEntitySchema
>;
export type LeaveRequestEntity = z.infer<typeof leaveRequestEntitySchema>;
