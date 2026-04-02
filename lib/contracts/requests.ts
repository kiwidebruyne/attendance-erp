import { z } from "zod";

import {
  apiDateSchema,
  apiDateTimeSchema,
  employeeSummarySchema,
  followUpKindSchema,
  leaveConflictSchema,
  leaveTypeSchema,
  manualAttendanceActionSchema,
  requestChainProjectionFieldsSchema,
  requestQueueViewSchema,
  requestRelationFieldsSchema,
  requestReviewStateFieldsSchema,
  requestStatusSchema,
  requestTypeSchema,
  validateRequestChainProjection,
  validateRequestRelations,
  validateRequestReviewState,
} from "@/lib/contracts/shared";

const adminRequestQueueItemBaseSchema = z.object({
  id: z.string().min(1),
  employee: employeeSummarySchema,
  targetDate: apiDateSchema,
  reason: z.string().min(1),
});

const adminManualAttendanceRequestRelationFieldsSchema =
  requestRelationFieldsSchema.extend({
    followUpKind: followUpKindSchema.extract(["resubmission"]).nullable(),
  });

const adminManualAttendanceRequestQueueItemSchema =
  adminRequestQueueItemBaseSchema
    .extend({
      requestType: z.literal("manual_attendance"),
      subtype: manualAttendanceActionSchema,
      submittedAt: apiDateTimeSchema,
    })
    .merge(requestReviewStateFieldsSchema)
    .merge(adminManualAttendanceRequestRelationFieldsSchema)
    .merge(requestChainProjectionFieldsSchema)
    .superRefine((value, ctx) => {
      validateRequestReviewState(value, ctx, "manual attendance request");
      validateRequestRelations(value, ctx, "manual attendance request");
      validateRequestChainProjection(value, ctx);
    });

const adminLeaveRequestQueueItemSchema = adminRequestQueueItemBaseSchema
  .extend({
    requestType: z.literal("leave"),
    subtype: leaveTypeSchema,
    requestedAt: apiDateTimeSchema,
    leaveConflict: leaveConflictSchema.optional(),
  })
  .merge(requestReviewStateFieldsSchema)
  .merge(requestRelationFieldsSchema)
  .merge(requestChainProjectionFieldsSchema)
  .superRefine((value, ctx) => {
    validateRequestReviewState(value, ctx, "leave request");
    validateRequestRelations(value, ctx, "leave request");
    validateRequestChainProjection(value, ctx);
  });

const adminRequestQueueItemSchema = z.union([
  adminManualAttendanceRequestQueueItemSchema,
  adminLeaveRequestQueueItemSchema,
]);

export const adminRequestsQuerySchema = z.strictObject({
  view: requestQueueViewSchema.optional(),
});

export const adminRequestsResponseSchema = z.strictObject({
  viewFilter: requestQueueViewSchema,
  items: z.array(adminRequestQueueItemSchema),
});

export const adminRequestDecisionBodySchema = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("approve"),
  }),
  z.strictObject({
    decision: z.literal("reject"),
    reviewComment: z.string().trim().min(1),
  }),
  z.strictObject({
    decision: z.literal("request_revision"),
    reviewComment: z.string().trim().min(1),
  }),
]);

const adminRequestDecisionResponseBaseSchema = z
  .object({
    id: z.string().min(1),
    requestType: requestTypeSchema,
  })
  .merge(
    requestReviewStateFieldsSchema.extend({
      status: requestStatusSchema.extract([
        "approved",
        "rejected",
        "revision_requested",
      ]),
    }),
  )
  .merge(requestChainProjectionFieldsSchema);

export const adminRequestDecisionResponseSchema =
  adminRequestDecisionResponseBaseSchema.superRefine((value, ctx) => {
    validateRequestReviewState(value, ctx, "request decision response");
    validateRequestChainProjection(value, ctx);

    if (value.activeRequestId !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["activeRequestId"],
        message:
          'Invalid input: "activeRequestId" must be null in a request decision response',
      });
    }

    if (value.activeStatus !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["activeStatus"],
        message:
          'Invalid input: "activeStatus" must be null in a request decision response',
      });
    }

    if (value.status === "approved" && value.governingReviewComment !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["governingReviewComment"],
        message:
          'Invalid input: "governingReviewComment" must be null when "status" is "approved"',
      });
    }

    if (
      value.status !== "approved" &&
      value.governingReviewComment !== value.reviewComment
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["governingReviewComment"],
        message:
          'Invalid input: "governingReviewComment" must match "reviewComment" for non-approved decision responses',
      });
    }

    if (value.status === "approved") {
      if (value.effectiveRequestId !== value.id) {
        ctx.addIssue({
          code: "custom",
          path: ["effectiveRequestId"],
          message:
            'Invalid input: "effectiveRequestId" must match "id" when a request decision response is approved',
        });
      }

      if (value.effectiveStatus !== "approved") {
        ctx.addIssue({
          code: "custom",
          path: ["effectiveStatus"],
          message:
            'Invalid input: "effectiveStatus" must be "approved" when a request decision response is approved',
        });
      }
    }

    if (
      value.requestType === "manual_attendance" &&
      value.status !== "approved"
    ) {
      if (value.effectiveRequestId !== value.id) {
        ctx.addIssue({
          code: "custom",
          path: ["effectiveRequestId"],
          message:
            'Invalid input: "effectiveRequestId" must match "id" for non-approved manual attendance decision responses',
        });
      }

      if (value.effectiveStatus !== value.status) {
        ctx.addIssue({
          code: "custom",
          path: ["effectiveStatus"],
          message:
            'Invalid input: "effectiveStatus" must match "status" for non-approved manual attendance decision responses',
        });
      }
    }

    if (value.requestType === "leave" && value.status !== "approved") {
      const reviewedRequestRemainsEffective =
        value.effectiveRequestId === value.id &&
        value.effectiveStatus === value.status;
      const priorApprovalRemainsEffective =
        value.effectiveRequestId !== value.id &&
        value.effectiveStatus === "approved";

      if (!reviewedRequestRemainsEffective && !priorApprovalRemainsEffective) {
        ctx.addIssue({
          code: "custom",
          path: ["effectiveStatus"],
          message:
            "Invalid input: leave decision responses must keep either the reviewed non-approved result or the prior approved result as effective",
        });
      }
    }
  });

export type AdminRequestsQuery = z.infer<typeof adminRequestsQuerySchema>;
export type AdminRequestsResponse = z.infer<typeof adminRequestsResponseSchema>;
export type AdminRequestDecisionBody = z.infer<
  typeof adminRequestDecisionBodySchema
>;
export type AdminRequestDecisionResponse = z.infer<
  typeof adminRequestDecisionResponseSchema
>;
