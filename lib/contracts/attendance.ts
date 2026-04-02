import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  attendanceAttemptSchema,
  attendanceDisplaySchema,
  attendanceRecordSchema,
  attendanceSurfaceManualRequestResourceSchema,
  employeeSummarySchema,
  expectedWorkdaySchema,
  followUpKindSchema,
  manualAttendanceActionSchema,
  manualAttendanceRequestResourceSchema,
  previousDayOpenRecordSchema,
  requestStatusSchema,
} from "@/lib/contracts/shared";

const attendanceHistoryRecordSchema = z.object({
  date: apiDateSchema,
  expectedWorkday: expectedWorkdaySchema,
  record: attendanceRecordSchema.nullable(),
  display: attendanceDisplaySchema,
});

export const attendanceTodayResponseSchema = z.object({
  date: apiDateSchema,
  employee: employeeSummarySchema,
  expectedWorkday: expectedWorkdaySchema,
  previousDayOpenRecord: previousDayOpenRecordSchema.nullable(),
  todayRecord: attendanceRecordSchema.nullable(),
  attempts: z.array(attendanceAttemptSchema),
  manualRequest: attendanceSurfaceManualRequestResourceSchema.nullable(),
  display: attendanceDisplaySchema,
});

export const attendanceHistoryQuerySchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
});

export const attendanceHistoryResponseSchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
  records: z.array(attendanceHistoryRecordSchema),
});

function validateManualAttendanceClockFields(
  value: {
    action: z.infer<typeof manualAttendanceActionSchema>;
    requestedClockInAt?: z.infer<typeof apiDateTimeSchema>;
    requestedClockOutAt?: z.infer<typeof apiDateTimeSchema>;
  },
  ctx: z.RefinementCtx,
) {
  const hasRequestedClockInAt = value.requestedClockInAt !== undefined;
  const hasRequestedClockOutAt = value.requestedClockOutAt !== undefined;

  if (value.action === "clock_in") {
    if (!hasRequestedClockInAt) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockInAt"],
        message:
          'Invalid input: "requestedClockInAt" is required when "action" is "clock_in"',
      });
    }

    if (hasRequestedClockOutAt) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockOutAt"],
        message:
          'Invalid input: "requestedClockOutAt" is not allowed when "action" is "clock_in"',
      });
    }
  }

  if (value.action === "clock_out") {
    if (!hasRequestedClockOutAt) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockOutAt"],
        message:
          'Invalid input: "requestedClockOutAt" is required when "action" is "clock_out"',
      });
    }

    if (hasRequestedClockInAt) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockInAt"],
        message:
          'Invalid input: "requestedClockInAt" is not allowed when "action" is "clock_out"',
      });
    }
  }

  if (value.action === "both") {
    if (!hasRequestedClockInAt) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockInAt"],
        message:
          'Invalid input: "requestedClockInAt" is required when "action" is "both"',
      });
    }

    if (!hasRequestedClockOutAt) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedClockOutAt"],
        message:
          'Invalid input: "requestedClockOutAt" is required when "action" is "both"',
      });
    }
  }
}

function validateManualAttendanceFollowUpFields(
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

export const manualAttendanceRequestBodySchema = z
  .strictObject({
    date: apiDateSchema,
    action: manualAttendanceActionSchema,
    requestedClockInAt: apiDateTimeSchema.optional(),
    requestedClockOutAt: apiDateTimeSchema.optional(),
    reason: z.string().min(1),
    parentRequestId: z.string().min(1).optional(),
    followUpKind: followUpKindSchema.extract(["resubmission"]).optional(),
  })
  .superRefine((value, ctx) => {
    validateManualAttendanceClockFields(value, ctx);
    validateManualAttendanceFollowUpFields(value, ctx);
  });

export const manualAttendanceRequestPatchBodySchema = z
  .strictObject({
    date: apiDateSchema.optional(),
    action: manualAttendanceActionSchema.optional(),
    requestedClockInAt: apiDateTimeSchema.optional(),
    requestedClockOutAt: apiDateTimeSchema.optional(),
    reason: z.string().min(1).optional(),
    status: requestStatusSchema.extract(["withdrawn"]).optional(),
  })
  .superRefine((value, ctx) => {
    const editableFieldNames = [
      "date",
      "action",
      "requestedClockInAt",
      "requestedClockOutAt",
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
          'Invalid input: "status" cannot be combined with editable fields when withdrawing a manual attendance request',
      });
    }

    if (value.action !== undefined) {
      validateManualAttendanceClockFields(
        {
          action: value.action,
          requestedClockInAt: value.requestedClockInAt,
          requestedClockOutAt: value.requestedClockOutAt,
        },
        ctx,
      );
    }

    if (value.status === undefined && !hasEditableFields) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message:
          'Invalid input: provide at least one editable field or set "status" to "withdrawn"',
      });
    }
  });

export const manualAttendanceRequestResponseSchema =
  manualAttendanceRequestResourceSchema;

export type AttendanceTodayResponse = z.infer<
  typeof attendanceTodayResponseSchema
>;
export type AttendanceHistoryQuery = z.infer<
  typeof attendanceHistoryQuerySchema
>;
export type AttendanceHistoryResponse = z.infer<
  typeof attendanceHistoryResponseSchema
>;
export type ManualAttendanceRequestBody = z.infer<
  typeof manualAttendanceRequestBodySchema
>;
export type ManualAttendanceRequestPatchBody = z.infer<
  typeof manualAttendanceRequestPatchBodySchema
>;
export type ManualAttendanceRequestResponse = z.infer<
  typeof manualAttendanceRequestResponseSchema
>;
