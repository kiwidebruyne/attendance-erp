import { z } from "zod";

import {
  apiDateSchema,
  attendanceDisplaySchema,
  attendanceRecordSchema,
  attendanceSurfaceManualRequestResourceSchema,
  employeeSummarySchema,
  expectedWorkdaySchema,
  failedAttendanceAttemptSchema,
} from "@/lib/contracts/shared";

const adminAttendanceTodayItemSchema = z.object({
  employee: employeeSummarySchema,
  expectedWorkday: expectedWorkdaySchema,
  todayRecord: attendanceRecordSchema.nullable(),
  display: attendanceDisplaySchema,
  latestFailedAttempt: failedAttendanceAttemptSchema.nullable(),
  manualRequest: attendanceSurfaceManualRequestResourceSchema.nullable(),
});

const adminAttendanceListRecordSchema = z.object({
  date: apiDateSchema,
  employee: employeeSummarySchema,
  expectedWorkday: expectedWorkdaySchema,
  record: attendanceRecordSchema.nullable(),
  display: attendanceDisplaySchema,
  latestFailedAttempt: failedAttendanceAttemptSchema.nullable(),
});

export const adminAttendanceTodayResponseSchema = z.object({
  date: apiDateSchema,
  summary: z.object({
    checkedInCount: z.number(),
    notCheckedInCount: z.number(),
    lateCount: z.number(),
    onLeaveCount: z.number(),
    failedAttemptCount: z.number(),
  }),
  items: z.array(adminAttendanceTodayItemSchema),
});

export const adminAttendanceListQuerySchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
  name: z.string().min(1).optional(),
});

export const adminAttendanceListResponseSchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
  filters: z.object({
    name: z.string().min(1).optional(),
  }),
  total: z.number(),
  records: z.array(adminAttendanceListRecordSchema),
});

export type AdminAttendanceTodayResponse = z.infer<
  typeof adminAttendanceTodayResponseSchema
>;
export type AdminAttendanceListQuery = z.infer<
  typeof adminAttendanceListQuerySchema
>;
export type AdminAttendanceListResponse = z.infer<
  typeof adminAttendanceListResponseSchema
>;
