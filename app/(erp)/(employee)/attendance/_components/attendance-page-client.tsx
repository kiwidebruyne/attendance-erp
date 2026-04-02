"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AttendancePageScreen } from "@/app/(erp)/(employee)/attendance/_components/attendance-page-screen";
import type { AttendanceManualRequestDraft } from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import {
  type AttendanceSheetState,
  type AttendanceSurfaceModel,
  toPendingEditSurfaceModel,
  toReviewResubmitSurfaceModel,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import {
  AttendanceApiError,
  createManualAttendanceRequest,
  updateManualAttendanceRequest,
} from "@/lib/attendance/api-client";
import type {
  AttendanceHistoryView,
  AttendancePageData,
} from "@/lib/attendance/page-data";
import type {
  ManualAttendanceRequestBody,
  ManualAttendanceRequestPatchBody,
} from "@/lib/contracts/attendance";

function toCreateRequestBody(
  draft: AttendanceManualRequestDraft,
): ManualAttendanceRequestBody {
  return {
    date: draft.date,
    action: draft.action,
    reason: draft.reason,
    ...toManualAttendanceClockFields(draft),
  };
}

function toPatchRequestBody(
  draft: AttendanceManualRequestDraft,
): ManualAttendanceRequestPatchBody {
  return {
    date: draft.date,
    action: draft.action,
    reason: draft.reason,
    ...toManualAttendanceClockFields(draft),
  };
}

function toManualAttendanceClockFields(draft: AttendanceManualRequestDraft) {
  if (draft.action === "clock_in") {
    return draft.requestedClockInAt === null
      ? {}
      : {
          requestedClockInAt: draft.requestedClockInAt,
        };
  }

  if (draft.action === "clock_out") {
    return draft.requestedClockOutAt === null
      ? {}
      : {
          requestedClockOutAt: draft.requestedClockOutAt,
        };
  }

  return {
    ...(draft.requestedClockInAt === null
      ? {}
      : {
          requestedClockInAt: draft.requestedClockInAt,
        }),
    ...(draft.requestedClockOutAt === null
      ? {}
      : {
          requestedClockOutAt: draft.requestedClockOutAt,
        }),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof AttendanceApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function AttendancePageClient({
  initialData,
}: Readonly<{
  initialData: AttendancePageData;
}>) {
  const router = useRouter();
  const [isRouting, startRoutingTransition] = useTransition();
  const [sheetState, setSheetState] = useState<AttendanceSheetState | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleOpenSheet = (surface: AttendanceSurfaceModel) => {
    setMutationError(null);
    setSheetState(surface);
  };

  const handleCloseSheet = () => {
    setMutationError(null);
    setSheetState(null);
  };

  const handleViewChange = (view: AttendanceHistoryView) => {
    setMutationError(null);
    startRoutingTransition(() => {
      router.push(
        view === "month" ? "/attendance?view=month" : "/attendance?view=week",
      );
    });
  };

  const handleSubmit = async (draft: AttendanceManualRequestDraft) => {
    if (sheetState === null) {
      return;
    }

    setIsSubmitting(true);
    setMutationError(null);

    try {
      if (sheetState.kind === "create") {
        await createManualAttendanceRequest(toCreateRequestBody(draft));
      }

      if (sheetState.kind === "pending_edit") {
        await updateManualAttendanceRequest(
          sheetState.request.id,
          toPatchRequestBody(draft),
        );
      }

      if (sheetState.kind === "review_resubmit") {
        await createManualAttendanceRequest({
          ...toCreateRequestBody(draft),
          parentRequestId: sheetState.draft.parentRequestId,
          followUpKind: "resubmission",
        });
      }

      handleCloseSheet();
      startRoutingTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMutationError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawPendingRequest = async () => {
    if (
      sheetState === null ||
      (sheetState.kind !== "pending" && sheetState.kind !== "pending_edit")
    ) {
      return;
    }

    setIsSubmitting(true);
    setMutationError(null);

    try {
      await updateManualAttendanceRequest(sheetState.request.id, {
        status: "withdrawn",
      });
      handleCloseSheet();
      startRoutingTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMutationError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AttendancePageScreen
      data={initialData}
      isSubmitting={isSubmitting || isRouting}
      mutationError={mutationError}
      sheetState={sheetState}
      onCloseSheet={handleCloseSheet}
      onEditPendingRequest={() => {
        if (sheetState?.kind !== "pending") {
          return;
        }

        setSheetState(toPendingEditSurfaceModel(sheetState));
      }}
      onOpenSheet={handleOpenSheet}
      onResubmitRequest={() => {
        if (sheetState?.kind !== "review") {
          return;
        }

        setSheetState(toReviewResubmitSurfaceModel(sheetState));
      }}
      onSubmit={handleSubmit}
      onViewChange={handleViewChange}
      onWithdrawPendingRequest={handleWithdrawPendingRequest}
    />
  );
}
