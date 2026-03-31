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
  z.strictObject({
    decision: z.literal("approve"),
  }),
  z.strictObject({
    decision: z.literal("reject"),
    rejectionReason: z.string().trim().min(1),
  }),
]);

const adminRequestDecisionResponseBaseSchema = z.object({
  id: z.string().min(1),
  requestType: requestTypeSchema,
  reviewedAt: apiDateTimeSchema,
});

export const adminRequestDecisionResponseSchema = z.discriminatedUnion(
  "status",
  [
    adminRequestDecisionResponseBaseSchema.extend({
      status: z.literal("approved"),
      rejectionReason: z.null(),
    }),
    adminRequestDecisionResponseBaseSchema.extend({
      status: z.literal("rejected"),
      rejectionReason: z.string().trim().min(1),
    }),
  ],
);

export type AdminRequestsQuery = z.infer<typeof adminRequestsQuerySchema>;
export type AdminRequestsResponse = z.infer<typeof adminRequestsResponseSchema>;
export type AdminRequestDecisionBody = z.infer<
  typeof adminRequestDecisionBodySchema
>;
export type AdminRequestDecisionResponse = z.infer<
  typeof adminRequestDecisionResponseSchema
>;
