import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  followUpKindSchema,
  leaveBalanceSchema,
  leaveConflictSchema,
  leaveRequestSchema,
  leaveTypeSchema,
  requestStatusSchema,
} from "@/lib/contracts/shared";

const selectedDateContextSchema = z.object({
  date: apiDateSchema,
  leaveConflict: leaveConflictSchema,
});

const leaveOverviewRequestItemSchema = leaveRequestSchema.and(
  z.object({
    leaveConflict: leaveConflictSchema.optional(),
    isTopSurfaceSuppressed: z.boolean(),
  }),
);

function validateLeaveFollowUpFields(
  value: {
    parentRequestId?: string;
    followUpKind?: z.infer<typeof followUpKindSchema>;
  },
  ctx: z.RefinementCtx,
) {
  const hasParentRequestId = value.parentRequestId !== undefined;
  const hasFollowUpKind = value.followUpKind !== undefined;

  if (hasParentRequestId && !hasFollowUpKind) {
    ctx.addIssue({
      code: "custom",
      path: ["followUpKind"],
      message:
        'Invalid input: "followUpKind" is required when "parentRequestId" is provided',
    });
  }

  if (hasFollowUpKind && !hasParentRequestId) {
    ctx.addIssue({
      code: "custom",
      path: ["parentRequestId"],
      message:
        'Invalid input: "parentRequestId" is required when "followUpKind" is provided',
    });
  }
}

function validateLeavePatchTimingFields(
  value: {
    leaveType?: z.infer<typeof leaveTypeSchema>;
    startAt?: z.infer<typeof apiDateTimeSchema>;
    endAt?: z.infer<typeof apiDateTimeSchema>;
  },
  ctx: z.RefinementCtx,
) {
  if (value.leaveType === undefined || value.leaveType === "hourly") {
    return;
  }

  if (value.startAt !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["startAt"],
      message:
        'Invalid input: "startAt" is only allowed when "leaveType" is "hourly"',
    });
  }

  if (value.endAt !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["endAt"],
      message:
        'Invalid input: "endAt" is only allowed when "leaveType" is "hourly"',
    });
  }
}

const hourlyLeaveRequestBodySchema = z.strictObject({
  leaveType: z.literal("hourly"),
  date: apiDateSchema,
  startAt: apiDateTimeSchema,
  endAt: apiDateTimeSchema,
  reason: z.string().min(1),
  parentRequestId: z.string().min(1).optional(),
  followUpKind: followUpKindSchema.optional(),
});

const nonHourlyLeaveRequestBodySchema = z.strictObject({
  leaveType: leaveTypeSchema.exclude(["hourly"]),
  date: apiDateSchema,
  reason: z.string().min(1),
  parentRequestId: z.string().min(1).optional(),
  followUpKind: followUpKindSchema.optional(),
});

export const leaveOverviewQuerySchema = z.strictObject({
  date: apiDateSchema.optional(),
});

export const leaveOverviewResponseSchema = z.object({
  balance: leaveBalanceSchema,
  selectedDateContext: selectedDateContextSchema.optional(),
  requests: z.array(leaveOverviewRequestItemSchema),
});

export const leaveRequestBodySchema = z
  .discriminatedUnion("leaveType", [
    hourlyLeaveRequestBodySchema,
    nonHourlyLeaveRequestBodySchema,
  ])
  .superRefine(validateLeaveFollowUpFields);

export const leaveRequestPatchBodySchema = z
  .strictObject({
    leaveType: leaveTypeSchema.optional(),
    date: apiDateSchema.optional(),
    startAt: apiDateTimeSchema.optional(),
    endAt: apiDateTimeSchema.optional(),
    reason: z.string().min(1).optional(),
    status: requestStatusSchema.extract(["withdrawn"]).optional(),
  })
  .superRefine((value, ctx) => {
    const editableFieldNames = [
      "leaveType",
      "date",
      "startAt",
      "endAt",
      "reason",
    ] as const;
    const hasEditableFields = editableFieldNames.some(
      (fieldName) => value[fieldName] !== undefined,
    );

    if (value.status === "withdrawn" && hasEditableFields) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message:
          'Invalid input: "status" cannot be combined with editable fields when withdrawing a leave request',
      });
    }

    validateLeavePatchTimingFields(value, ctx);

    if (value.status === undefined && !hasEditableFields) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message:
          'Invalid input: provide at least one editable field or set "status" to "withdrawn"',
      });
    }
  });

export const leaveRequestResponseSchema = leaveRequestSchema;

export type LeaveOverviewQuery = z.infer<typeof leaveOverviewQuerySchema>;
export type LeaveOverviewResponse = z.infer<typeof leaveOverviewResponseSchema>;
export type LeaveRequestBody = z.infer<typeof leaveRequestBodySchema>;
export type LeaveRequestPatchBody = z.infer<typeof leaveRequestPatchBodySchema>;
export type LeaveRequestResponse = z.infer<typeof leaveRequestResponseSchema>;
