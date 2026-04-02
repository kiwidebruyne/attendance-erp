import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  attendanceAttemptSchema,
  attendanceDisplaySchema,
  attendanceRecordSchema,
  employeeSummarySchema,
  expectedWorkdaySchema,
  followUpKindSchema,
  manualAttendanceActionSchema,
  manualAttendanceRequestResourceSchema,
  previousDayOpenRecordSchema,
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
  manualRequest: manualAttendanceRequestResourceSchema.nullable(),
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

export const manualAttendanceRequestBodySchema = z
  .object({
    date: apiDateSchema,
    action: manualAttendanceActionSchema,
    requestedAt: apiDateTimeSchema,
    reason: z.string().min(1),
    parentRequestId: z.string().min(1).optional(),
    followUpKind: followUpKindSchema.extract(["resubmission"]).optional(),
  })
  .superRefine((value, ctx) => {
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
export type ManualAttendanceRequestResponse = z.infer<
  typeof manualAttendanceRequestResponseSchema
>;
