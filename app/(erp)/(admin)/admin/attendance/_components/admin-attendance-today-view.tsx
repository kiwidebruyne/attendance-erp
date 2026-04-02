import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";

import {
  formatDateLabel,
  formatTimeLabel,
  getDisplaySummary,
  getManualRequestActionLabel,
  getManualRequestStatusLabel,
} from "../_lib/formatting";
import { groupAdminAttendanceTodayRows } from "../_lib/page-state";
import { AdminAttendanceSummaryCards } from "./admin-attendance-summary-cards";

type AdminAttendanceTodayViewProps = {
  response: AdminAttendanceTodayResponse;
};

type TodayItem = AdminAttendanceTodayResponse["items"][number];

function isTodayQueueItem(item: TodayItem) {
  return (
    item.previousDayOpenRecord !== null ||
    item.latestFailedAttempt !== null ||
    item.manualRequest !== null ||
    item.display.activeExceptions.length > 0 ||
    item.display.flags.includes("late")
  );
}

const groupMetadata = [
  {
    key: "previousDayOpen",
    title: "전날 기록 확인",
    description: "퇴근 누락이 오늘 운영 상태까지 이어진 근태예요.",
  },
  {
    key: "failedAttempts",
    title: "실패한 시도",
    description: "비콘 또는 앱 확인이 실패한 시도예요.",
  },
  {
    key: "manualRequests",
    title: "정정 요청 상태",
    description: "현재 근태를 설명하는 정정 요청 흐름이에요.",
  },
  {
    key: "operationalRows",
    title: "오늘 확인 필요",
    description: "오늘 안에 사실 확인이 필요한 근태예요.",
  },
] as const;

function RowBadges({ item }: { item: TodayItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      {item.previousDayOpenRecord !== null ? (
        <Badge variant="outline">전날 미퇴근</Badge>
      ) : null}
      {item.latestFailedAttempt !== null ? (
        <Badge variant="outline">시도 실패</Badge>
      ) : null}
      {item.manualRequest !== null ? (
        <Badge variant="secondary">정정 요청</Badge>
      ) : null}
      {item.display.activeExceptions.includes("not_checked_in") ? (
        <Badge variant="outline">출근 기록 없음</Badge>
      ) : null}
      {item.display.flags.includes("late") ? (
        <Badge variant="outline">지각</Badge>
      ) : null}
      {item.expectedWorkday.leaveCoverage !== null ? (
        <Badge variant="outline">휴가 반영</Badge>
      ) : null}
    </div>
  );
}

function TodayQueueRow({ item }: { item: TodayItem }) {
  const expectedWindow =
    item.expectedWorkday.adjustedClockInAt === null &&
    item.expectedWorkday.adjustedClockOutAt === null
      ? "휴가로 오늘 기본 근무 시간이 없어요."
      : `${formatTimeLabel(item.expectedWorkday.adjustedClockInAt)} ~ ${formatTimeLabel(item.expectedWorkday.adjustedClockOutAt)}`;

  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">
                {item.employee.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.employee.department}
              </p>
            </div>
            <p className="text-sm text-foreground">
              {item.previousDayOpenRecord !== null
                ? "어제 퇴근 기록이 아직 없어요."
                : item.latestFailedAttempt !== null
                  ? "출결 시도가 확인되지 않았어요."
                  : item.manualRequest !== null
                    ? getManualRequestStatusLabel(item.manualRequest)
                    : getDisplaySummary(item.display)}
            </p>
          </div>
          <RowBadges item={item} />
        </div>

        <dl className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt>기준 시간</dt>
            <dd className="text-foreground">{expectedWindow}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>출근</dt>
            <dd className="text-foreground">
              {formatTimeLabel(item.todayRecord?.clockInAt ?? null)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>퇴근</dt>
            <dd className="text-foreground">
              {formatTimeLabel(item.todayRecord?.clockOutAt ?? null)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>다음 확인</dt>
            <dd className="text-foreground">
              {item.previousDayOpenRecord !== null
                ? "전날 퇴근 사실 확인"
                : item.latestFailedAttempt !== null
                  ? "실패 사유 확인"
                  : item.manualRequest !== null
                    ? "정정 요청 상태 확인"
                    : "오늘 기록 확인"}
            </dd>
          </div>
        </dl>

        {item.previousDayOpenRecord !== null ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              대상일 {formatDateLabel(item.previousDayOpenRecord.date)}
            </p>
            <p>
              전날 출근 {formatTimeLabel(item.previousDayOpenRecord.clockInAt)}{" "}
              / 예상 퇴근{" "}
              {formatTimeLabel(item.previousDayOpenRecord.expectedClockOutAt)}
            </p>
          </div>
        ) : null}

        {item.latestFailedAttempt !== null ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              마지막 실패{" "}
              {formatTimeLabel(item.latestFailedAttempt.attemptedAt)}
            </p>
            <p className="break-words">
              {item.latestFailedAttempt.failureReason}
            </p>
          </div>
        ) : null}

        {item.manualRequest !== null ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {getManualRequestActionLabel(item.manualRequest.action)} · 대상일{" "}
              {formatDateLabel(item.manualRequest.date)}
            </p>
            <p>
              제출 상태 {getManualRequestStatusLabel(item.manualRequest)} / 제출
              시각 {formatTimeLabel(item.manualRequest.submittedAt)}
            </p>
            {item.manualRequest.governingReviewComment !== null ? (
              <p className="break-words text-foreground">
                {item.manualRequest.governingReviewComment}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function AdminAttendanceTodayView({
  response,
}: AdminAttendanceTodayViewProps) {
  const groupedItems = groupAdminAttendanceTodayRows(
    response.items.filter(isTodayQueueItem),
  );
  const hasQueueRows = Object.values(groupedItems).some(
    (items) => items.length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminAttendanceSummaryCards summary={response.summary} />

      <section className="flex flex-col gap-4" aria-label="오늘 운영 큐">
        {!hasQueueRows ? (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyTitle>오늘 바로 확인할 근태가 없어요.</EmptyTitle>
              <EmptyDescription>
                지금은 예외 없이 운영 중이에요. 요약 카드에서 전체 상태를 확인할
                수 있어요.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {groupMetadata.map((group) => {
          const items = groupedItems[group.key];

          if (items.length === 0) {
            return null;
          }

          return (
            <Card key={group.key}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <TodayQueueRow
                      key={`${group.key}-${item.employee.id}`}
                      item={item}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
