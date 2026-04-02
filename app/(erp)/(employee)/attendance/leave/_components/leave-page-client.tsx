"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { LeavePageScreen } from "@/app/(erp)/(employee)/attendance/leave/_components/leave-page-screen";
import { buildDateTimeFromDateAndTime } from "@/app/(erp)/(employee)/attendance/leave/_lib/format";
import type { LeavePageData } from "@/app/(erp)/(employee)/attendance/leave/_lib/page-data";
import {
  buildLeavePageViewModel,
  createCancelComposerDraft,
  createChangeComposerDraft,
  createEditComposerDraft,
  createNewComposerDraft,
  createResubmitComposerDraft,
  findChainByAction,
  type LeaveChainAction,
  type LeaveChainModel,
  type LeaveComposerDraft,
} from "@/app/(erp)/(employee)/attendance/leave/_lib/view-model";
import type {
  LeaveRequestBody,
  LeaveRequestPatchBody,
} from "@/lib/contracts/leave";
import {
  createLeaveRequest,
  LeaveApiError,
  updateLeaveRequest,
} from "@/lib/leave/api-client";

function getErrorMessage(error: unknown) {
  if (error instanceof LeaveApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "요청을 처리하지 못했어요 잠시 후 다시 시도해 주세요";
}

function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function addMonths(month: string, delta: number) {
  const cursor = new Date(`${month}T00:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() + delta);
  cursor.setUTCDate(1);
  return cursor.toISOString().slice(0, 10);
}

function getDefaultCorrectionCandidateId(
  viewModel: ReturnType<typeof buildLeavePageViewModel>,
) {
  return viewModel.correctionCandidates[0]?.rootRequestId ?? null;
}

function upsertLeaveRequestOverview(
  overview: LeavePageData["overview"],
  request: LeavePageData["overview"]["requests"][number],
) {
  const requests = overview.requests.some((item) => item.id === request.id)
    ? overview.requests.map((item) => (item.id === request.id ? request : item))
    : [...overview.requests, request];

  return {
    ...overview,
    requests,
  };
}

function getTargetRequest(chain: LeaveChainModel, action: LeaveChainAction) {
  return (
    chain.requests.find((request) => request.id === action.requestId) ??
    chain.latestRequest
  );
}

function buildDraftFromAction(
  chain: LeaveChainModel,
  action: LeaveChainAction,
) {
  const request = getTargetRequest(chain, action);
  const startTime =
    request.startAt === null ? "" : request.startAt.slice(11, 16);
  const endTime = request.endAt === null ? "" : request.endAt.slice(11, 16);

  switch (action.kind) {
    case "edit":
      return createEditComposerDraft(request, { endTime, startTime });
    case "resubmit":
      return createResubmitComposerDraft(request, { endTime, startTime });
    case "change":
      return createChangeComposerDraft(request, { endTime, startTime });
    case "cancel":
      return createCancelComposerDraft(request, { endTime, startTime });
    case "withdraw":
      return null;
  }
}

function hasValidHourlyRange(draft: LeaveComposerDraft) {
  if (draft.leaveType !== "hourly") {
    return true;
  }

  const startAt = buildDateTimeFromDateAndTime(draft.date, draft.startTime);
  const endAt = buildDateTimeFromDateAndTime(draft.date, draft.endTime);

  return (
    startAt !== null &&
    endAt !== null &&
    new Date(endAt).getTime() > new Date(startAt).getTime()
  );
}

function toCreateBody(draft: LeaveComposerDraft): LeaveRequestBody {
  if (draft.leaveType === "hourly") {
    const startAt = buildDateTimeFromDateAndTime(draft.date, draft.startTime);
    const endAt = buildDateTimeFromDateAndTime(draft.date, draft.endTime);

    if (startAt === null || endAt === null) {
      throw new Error("시간차 입력이 올바르지 않아요");
    }

    return {
      date: draft.date,
      endAt,
      followUpKind: draft.followUpKind ?? undefined,
      leaveType: "hourly",
      parentRequestId: draft.parentRequestId ?? undefined,
      reason: draft.reason.trim(),
      startAt,
    };
  }

  return {
    date: draft.date,
    followUpKind: draft.followUpKind ?? undefined,
    leaveType: draft.leaveType,
    parentRequestId: draft.parentRequestId ?? undefined,
    reason: draft.reason.trim(),
  };
}

function toPatchBody(draft: LeaveComposerDraft): LeaveRequestPatchBody {
  if (draft.leaveType === "hourly") {
    const startAt = buildDateTimeFromDateAndTime(draft.date, draft.startTime);
    const endAt = buildDateTimeFromDateAndTime(draft.date, draft.endTime);

    if (startAt === null || endAt === null) {
      throw new Error("시간차 입력이 올바르지 않아요");
    }

    return {
      date: draft.date,
      endAt,
      leaveType: "hourly",
      reason: draft.reason.trim(),
      startAt,
    };
  }

  return {
    date: draft.date,
    leaveType: draft.leaveType,
    reason: draft.reason.trim(),
  };
}

export function LeavePageClient({
  initialData,
}: Readonly<{
  initialData: LeavePageData;
}>) {
  const router = useRouter();
  const [isRouting, startRoutingTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [optimisticOverview, setOptimisticOverview] = useState(
    initialData.overview,
  );
  const viewModel = buildLeavePageViewModel({
    ...initialData,
    overview: optimisticOverview,
  });
  const [visibleMonth, setVisibleMonth] = useState(
    startOfMonth(initialData.selectedDate),
  );
  const [correctionCandidateId, setCorrectionCandidateId] = useState<
    string | null
  >(getDefaultCorrectionCandidateId(viewModel));
  const [composerDraft, setComposerDraft] = useState<LeaveComposerDraft | null>(
    null,
  );
  const [composerChainRootId, setComposerChainRootId] = useState<string | null>(
    null,
  );
  const [composerScrollRequest, setComposerScrollRequest] = useState(0);
  const correctionCandidateKey = viewModel.correctionCandidates
    .map((candidate) => candidate.rootRequestId)
    .join("|");
  const visibleChainKey = viewModel.visibleChains
    .map((chain) => chain.rootRequestId)
    .join("|");

  const composerChain =
    composerChainRootId === null
      ? null
      : (viewModel.visibleChains.find(
          (chain) => chain.rootRequestId === composerChainRootId,
        ) ?? null);

  useEffect(() => {
    setVisibleMonth(startOfMonth(initialData.selectedDate));
  }, [initialData.selectedDate]);

  useEffect(() => {
    setOptimisticOverview(initialData.overview);
  }, [initialData.overview]);

  useEffect(() => {
    const correctionCandidateIds =
      correctionCandidateKey.length === 0
        ? []
        : correctionCandidateKey.split("|");

    setCorrectionCandidateId((current) => {
      if (current !== null && correctionCandidateIds.includes(current)) {
        return current;
      }

      return correctionCandidateIds[0] ?? null;
    });
  }, [correctionCandidateKey]);

  useEffect(() => {
    const visibleChainIds =
      visibleChainKey.length === 0 ? [] : visibleChainKey.split("|");

    if (
      composerChainRootId !== null &&
      !visibleChainIds.includes(composerChainRootId)
    ) {
      setComposerChainRootId(null);
    }
  }, [composerChainRootId, visibleChainKey]);

  const handleSelectDate = (date: string) => {
    if (date === initialData.selectedDate) {
      return;
    }

    setMutationError(null);
    startRoutingTransition(() => {
      router.push(`/attendance/leave?date=${date}`);
    });
  };

  const handleRunChainAction = async (action: LeaveChainAction) => {
    const chain = findChainByAction(viewModel.visibleChains, action);

    if (chain === null) {
      return;
    }

    const targetRequest = getTargetRequest(chain, action);
    setVisibleMonth(startOfMonth(targetRequest.date));

    if (targetRequest.date !== initialData.selectedDate) {
      startRoutingTransition(() => {
        router.push(`/attendance/leave?date=${targetRequest.date}`);
      });
    }

    if (action.kind === "withdraw") {
      if (!window.confirm("검토 전에 이 요청을 철회할까요?")) {
        return;
      }

      setIsSubmitting(true);
      setMutationError(null);

      try {
        const request = await updateLeaveRequest(action.requestId, {
          status: "withdrawn",
        });
        setOptimisticOverview((current) =>
          upsertLeaveRequestOverview(current, request),
        );
        setComposerDraft(null);
        setComposerChainRootId(null);
        startRoutingTransition(() => {
          router.refresh();
        });
      } catch (error) {
        setMutationError(getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    setMutationError(null);
    setComposerChainRootId(chain.rootRequestId);
    setComposerDraft(buildDraftFromAction(chain, action));
    setComposerScrollRequest((current) => current + 1);
  };

  const handleSubmitComposer = async () => {
    if (composerDraft === null) {
      return;
    }

    if (composerDraft.reason.trim().length === 0) {
      setMutationError("사유를 입력해 주세요");
      return;
    }

    if (!hasValidHourlyRange(composerDraft)) {
      setMutationError(
        "시간차는 시작 시간과 종료 시간을 올바르게 입력해 주세요",
      );
      return;
    }

    setIsSubmitting(true);
    setMutationError(null);

    try {
      if (composerDraft.mode === "edit") {
        if (composerDraft.requestId === null) {
          throw new Error("수정할 요청을 찾지 못했어요");
        }

        const request = await updateLeaveRequest(
          composerDraft.requestId,
          toPatchBody(composerDraft),
        );
        setOptimisticOverview((current) =>
          upsertLeaveRequestOverview(current, request),
        );
      } else {
        const request = await createLeaveRequest(toCreateBody(composerDraft));
        setOptimisticOverview((current) =>
          upsertLeaveRequestOverview(current, request),
        );
      }

      setComposerDraft(null);
      setComposerChainRootId(null);
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
    <LeavePageScreen
      composerChain={composerChain}
      composerDraft={composerDraft}
      composerScrollRequest={composerScrollRequest}
      correctionCandidateId={correctionCandidateId}
      data={initialData}
      isSubmitting={isSubmitting || isRouting}
      mutationError={mutationError}
      onClearComposer={() => {
        setComposerDraft(null);
        setComposerChainRootId(null);
        setMutationError(null);
      }}
      onComposerFieldChange={(patch) => {
        setMutationError(null);
        setComposerDraft((current) =>
          current === null ? current : { ...current, ...patch },
        );
      }}
      onCorrectionCandidateChange={setCorrectionCandidateId}
      onMonthChange={(delta) => {
        setVisibleMonth((current) => addMonths(current, delta));
      }}
      onOpenNewComposer={() => {
        setMutationError(null);
        setComposerChainRootId(null);
        setComposerDraft(createNewComposerDraft(initialData.selectedDate));
        setComposerScrollRequest((current) => current + 1);
      }}
      onRunChainAction={handleRunChainAction}
      onSelectDate={handleSelectDate}
      onSubmitComposer={handleSubmitComposer}
      viewModel={viewModel}
      visibleMonth={visibleMonth}
    />
  );
}
