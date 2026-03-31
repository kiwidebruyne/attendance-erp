import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  approvalStatusSchema,
  approvedApprovalStateSchema,
  employeeSummarySchema,
  leaveTypeSchema,
  manualAttendanceActionSchema,
  pendingApprovalStateSchema,
  rejectedApprovalStateSchema,
  requestTypeSchema,
} from "@/lib/contracts/shared";

const adminRequestQueueItemBaseSchema = z.object({
  id: z.string().min(1),
  employee: employeeSummarySchema,
  targetDate: apiDateSchema,
  reason: z.string().min(1),
  requestedAt: apiDateTimeSchema,
});

const adminManualAttendanceRequestQueueItemBaseSchema =
  adminRequestQueueItemBaseSchema.extend({
    requestType: z.literal("manual_attendance"),
    subtype: manualAttendanceActionSchema,
  });

const adminLeaveRequestQueueItemBaseSchema =
  adminRequestQueueItemBaseSchema.extend({
    requestType: z.literal("leave"),
    subtype: leaveTypeSchema,
  });

const adminManualAttendanceRequestQueueItemSchemas = [
  adminManualAttendanceRequestQueueItemBaseSchema.merge(
    pendingApprovalStateSchema,
  ),
  adminManualAttendanceRequestQueueItemBaseSchema.merge(
    approvedApprovalStateSchema,
  ),
  adminManualAttendanceRequestQueueItemBaseSchema.merge(
    rejectedApprovalStateSchema,
  ),
];

const adminLeaveRequestQueueItemSchemas = [
  adminLeaveRequestQueueItemBaseSchema.merge(pendingApprovalStateSchema),
  adminLeaveRequestQueueItemBaseSchema.merge(approvedApprovalStateSchema),
  adminLeaveRequestQueueItemBaseSchema.merge(rejectedApprovalStateSchema),
];

const adminRequestQueueItemSchema = z.union([
  ...adminManualAttendanceRequestQueueItemSchemas,
  ...adminLeaveRequestQueueItemSchemas,
]);

export const adminRequestsQuerySchema = z.object({
  status: approvalStatusSchema.optional(),
});

export const adminRequestsResponseSchema = z.object({
  statusFilter: approvalStatusSchema.optional(),
  items: z.array(adminRequestQueueItemSchema),
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
