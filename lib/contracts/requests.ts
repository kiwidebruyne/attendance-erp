import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  approvalStatusSchema,
  employeeSummarySchema,
  leaveTypeSchema,
  manualAttendanceActionSchema,
  requestTypeSchema,
} from "@/lib/contracts/shared";

const finalizedApprovalStatusSchema = approvalStatusSchema.exclude(["pending"]);

const adminManualAttendanceRequestQueueItemSchema = z.object({
  id: z.string().min(1),
  employee: employeeSummarySchema,
  requestType: z.literal("manual_attendance"),
  subtype: manualAttendanceActionSchema,
  targetDate: apiDateSchema,
  reason: z.string().min(1),
  status: approvalStatusSchema,
  requestedAt: apiDateTimeSchema,
  reviewedAt: apiDateTimeSchema.nullable(),
  rejectionReason: z.string().nullable(),
});

const adminLeaveRequestQueueItemSchema = z.object({
  id: z.string().min(1),
  employee: employeeSummarySchema,
  requestType: z.literal("leave"),
  subtype: leaveTypeSchema,
  targetDate: apiDateSchema,
  reason: z.string().min(1),
  status: approvalStatusSchema,
  requestedAt: apiDateTimeSchema,
  reviewedAt: apiDateTimeSchema.nullable(),
  rejectionReason: z.string().nullable(),
});

export const adminRequestsQuerySchema = z.object({
  status: approvalStatusSchema.optional(),
});

export const adminRequestsResponseSchema = z.object({
  statusFilter: approvalStatusSchema.optional(),
  items: z.array(
    z.discriminatedUnion("requestType", [
      adminManualAttendanceRequestQueueItemSchema,
      adminLeaveRequestQueueItemSchema,
    ]),
  ),
});

export const adminRequestDecisionBodySchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
  }),
  z.object({
    decision: z.literal("reject"),
    rejectionReason: z.string().trim().min(1),
  }),
]);

export const adminRequestDecisionResponseSchema = z.object({
  id: z.string().min(1),
  requestType: requestTypeSchema,
  status: finalizedApprovalStatusSchema,
  reviewedAt: apiDateTimeSchema,
  rejectionReason: z.string().nullable(),
});

export type AdminRequestsQuery = z.infer<typeof adminRequestsQuerySchema>;
export type AdminRequestsResponse = z.infer<typeof adminRequestsResponseSchema>;
export type AdminRequestDecisionBody = z.infer<
  typeof adminRequestDecisionBodySchema
>;
export type AdminRequestDecisionResponse = z.infer<
  typeof adminRequestDecisionResponseSchema
>;
