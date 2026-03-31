import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  approvalStatusSchema,
  attendanceRecordSchema,
  attendanceStateSchema,
  employeeSummarySchema,
  manualAttendanceActionSchema,
  manualAttendanceRequestResourceSchema,
} from "@/lib/contracts/shared";

export const attendanceTodayResponseSchema = z.object({
  date: apiDateSchema,
  employee: employeeSummarySchema,
  today: attendanceStateSchema.extend({
    manualRequest: manualAttendanceRequestResourceSchema.nullable(),
  }),
});

export const attendanceHistoryQuerySchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
});

export const attendanceHistoryResponseSchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
  records: z.array(attendanceRecordSchema),
});

export const manualAttendanceRequestBodySchema = z.object({
  date: apiDateSchema,
  action: manualAttendanceActionSchema,
  requestedAt: apiDateTimeSchema,
  reason: z.string().min(1),
});

export const manualAttendanceRequestResponseSchema =
  manualAttendanceRequestResourceSchema.extend({
    status: approvalStatusSchema,
  });

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
