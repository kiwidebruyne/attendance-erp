import { z } from "zod";

import {
  apiDateSchema,
  leaveBalanceSchema,
  leaveRequestSchema,
  leaveTypeSchema,
} from "@/lib/contracts/shared";

const hourlyLeaveRequestBodySchema = z.object({
  leaveType: z.literal("hourly"),
  date: apiDateSchema,
  hours: z.number(),
  reason: z.string().min(1),
});

const nonHourlyLeaveRequestBodySchema = z.object({
  leaveType: leaveTypeSchema.exclude(["hourly"]),
  date: apiDateSchema,
  hours: z.number().nullable().optional(),
  reason: z.string().min(1),
});

export const leaveOverviewResponseSchema = z.object({
  balance: leaveBalanceSchema,
  requests: z.array(leaveRequestSchema),
});

export const leaveRequestBodySchema = z.discriminatedUnion("leaveType", [
  hourlyLeaveRequestBodySchema,
  nonHourlyLeaveRequestBodySchema,
]);

export const leaveRequestResponseSchema = leaveRequestSchema;

export type LeaveOverviewResponse = z.infer<typeof leaveOverviewResponseSchema>;
export type LeaveRequestBody = z.infer<typeof leaveRequestBodySchema>;
export type LeaveRequestResponse = z.infer<typeof leaveRequestResponseSchema>;
