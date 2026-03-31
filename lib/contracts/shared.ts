import { z } from "zod";

export const apiDateSchema = z.iso.date();
export const apiDateTimeSchema = z.iso.datetime({ offset: true });

export const attendanceStatusSchema = z.enum([
  "working",
  "normal",
  "late",
  "early_leave",
  "absent",
  "on_leave",
]);

export const verificationMethodSchema = z.enum(["beacon", "manual", "none"]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
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

export const attendanceStateSchema = z.object({
  clockInAt: apiDateTimeSchema.nullable(),
  clockOutAt: apiDateTimeSchema.nullable(),
  workMinutes: z.number().nullable(),
  status: attendanceStatusSchema,
  beaconVerified: z.boolean(),
  verificationMethod: verificationMethodSchema,
});

export const attendanceRecordSchema = attendanceStateSchema.extend({
  date: apiDateSchema,
});

export const adminAttendanceItemSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  clockInAt: apiDateTimeSchema.nullable(),
  clockOutAt: apiDateTimeSchema.nullable(),
  status: attendanceStatusSchema,
  verificationMethod: verificationMethodSchema,
});

export const adminAttendanceListRecordSchema = adminAttendanceItemSchema.extend(
  {
    date: apiDateSchema,
    workMinutes: z.number().nullable(),
  },
);

export const leaveBalanceSchema = z.object({
  totalDays: z.number(),
  usedDays: z.number(),
  remainingDays: z.number(),
});

export const leaveRequestSchema = z.object({
  id: z.string().min(1),
  requestType: z.literal("leave"),
  leaveType: leaveTypeSchema,
  date: apiDateSchema,
  hours: z.number().nullable(),
  reason: z.string().min(1),
  status: approvalStatusSchema,
  requestedAt: apiDateTimeSchema,
  reviewedAt: apiDateTimeSchema.nullable(),
  rejectionReason: z.string().nullable(),
});

export const manualAttendanceRequestResourceSchema = z.object({
  id: z.string().min(1),
  requestType: z.literal("manual_attendance"),
  action: manualAttendanceActionSchema,
  date: apiDateSchema,
  requestedAt: apiDateTimeSchema,
  reason: z.string().min(1),
  status: approvalStatusSchema,
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
  }),
});

export type ApiDate = z.infer<typeof apiDateSchema>;
export type ApiDateTime = z.infer<typeof apiDateTimeSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type VerificationMethod = z.infer<typeof verificationMethodSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ManualAttendanceAction = z.infer<
  typeof manualAttendanceActionSchema
>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type RequestType = z.infer<typeof requestTypeSchema>;
export type EmployeeSummary = z.infer<typeof employeeSummarySchema>;
export type AttendanceState = z.infer<typeof attendanceStateSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type ManualAttendanceRequestResource = z.infer<
  typeof manualAttendanceRequestResourceSchema
>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
