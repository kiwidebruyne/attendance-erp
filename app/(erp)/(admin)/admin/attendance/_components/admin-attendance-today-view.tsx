"use client";

import { SearchIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";
import { cn } from "@/lib/utils";

import {
  formatDateLabel,
  formatTimeLabel,
  getDisplaySummary,
} from "../_lib/formatting";
import { groupAdminAttendanceTodayRows } from "../_lib/page-state";
import { AdminAttendanceSummaryCards } from "./admin-attendance-summary-cards";

type AdminAttendanceTodayViewProps = {
  name?: string;
  onNameChange?: (name: string) => void;
  response: AdminAttendanceTodayResponse;
};

type TodayItem = AdminAttendanceTodayResponse["items"][number];

type BadgeTone = "danger" | "warning" | "info" | "success" | "neutral";

type ItemBadge = {
  label: string;
  tone: BadgeTone;
};

const groupMetadata = [
  {
    key: "previousDayOpen",
    title: "전날 기록 확인",
    description: "퇴근 누락이 오늘 운영 상태까지 이어지는 근태예요",
  },
  {
    key: "failedAttempts",
    title: "실패한 시도",
    description: "비콘 또는 앱 확인이 실패한 시도예요",
  },
  {
    key: "manualRequests",
    title: "정정 요청 상태",
    description: "현재 근태를 설명하는 정정 요청 흐름이에요",
  },
  {
    key: "operationalRows",
    title: "오늘 확인 필요",
    description: "오늘 안에 사실 확인이 필요한 근태예요",
  },
] as const;

function cleanSentence(value: string) {
  return value.replace(/[.。]\s*$/, "");
}

function isTodayQueueItem(item: TodayItem) {
  return (
    item.previousDayOpenRecord !== null ||
    item.latestFailedAttempt !== null ||
    item.manualRequest !== null ||
    item.display.activeExceptions.length > 0 ||
    item.display.flags.includes("late")
  );
}

function getBadgeClassName(tone: BadgeTone) {
  if (tone === "danger") {
    return "bg-status-danger-soft text-status-danger";
  }

  if (tone === "warning") {
    return "bg-status-warning-soft text-status-warning";
  }

  if (tone === "info") {
    return "bg-status-info-soft text-status-info";
  }

  if (tone === "success") {
    return "bg-status-success-soft text-status-success";
  }

  return "bg-muted text-secondary";
}

function getItemBadges(item: TodayItem) {
  const badges: ItemBadge[] = [];

  if (item.previousDayOpenRecord !== null) {
    badges.push({
      label: "전날 미퇴근",
      tone: "danger",
    });
  } else if (item.latestFailedAttempt !== null) {
    badges.push({
      label: "시도 실패",
      tone: "warning",
    });
  } else if (item.manualRequest !== null) {
    badges.push({
      label:
        item.manualRequest.status === "pending"
          ? "검토 중"
          : item.manualRequest.status === "revision_requested"
            ? "보완 필요"
            : "반려",
      tone: item.manualRequest.status === "pending" ? "info" : "warning",
    });
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    badges.push({
      label: "휴가 충돌",
      tone: "info",
    });
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    badges.push({
      label: "출근 기록 없음",
      tone: "danger",
    });
  }

  if (item.display.activeExceptions.includes("absent")) {
    badges.push({
      label: "결근",
      tone: "danger",
    });
  }

  if (item.display.flags.includes("late")) {
    badges.push({
      label: "지각",
      tone: "warning",
    });
  }

  if (item.display.flags.includes("early_leave")) {
    badges.push({
      label: "조퇴",
      tone: "warning",
    });
  }

  if (item.expectedWorkday.leaveCoverage !== null) {
    badges.push({
      label: "휴가 반영",
      tone: "info",
    });
  }

  const seen = new Set<string>();

  return badges.filter((badge) => {
    if (seen.has(badge.label)) {
      return false;
    }

    seen.add(badge.label);
    return true;
  });
}

function getCurrentStateLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return "전날 퇴근 기록이 아직 없어요";
  }

  if (item.latestFailedAttempt !== null) {
    return "출결 시도가 실패했어요";
  }

  if (item.manualRequest !== null) {
    if (item.manualRequest.status === "pending") {
      return "정정 요청을 검토 중이에요";
    }

    if (item.manualRequest.status === "revision_requested") {
      return "정정 요청 보완이 필요해요";
    }

    return "정정 요청이 반려됐어요";
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가와 실제 출결이 함께 보여요";
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    return "오늘 출근 기록이 없어요";
  }

  if (
    item.display.flags.includes("late") &&
    item.display.flags.includes("early_leave")
  ) {
    return "지각과 조퇴가 함께 보여요";
  }

  if (item.display.flags.includes("late")) {
    return "오늘 지각으로 기록됐어요";
  }

  if (item.display.flags.includes("early_leave")) {
    return "오늘 조퇴로 기록됐어요";
  }

  if (item.display.activeExceptions.includes("absent")) {
    return "오늘 결근으로 보여요";
  }

  if (item.expectedWorkday.leaveCoverage !== null) {
    return "오늘 휴가가 반영됐어요";
  }

  if (item.todayRecord !== null) {
    return "오늘 근태가 정상이에요";
  }

  return "오늘 운영 상태를 확인해요";
}

function getContextLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return `대상일 ${formatDateLabel(item.previousDayOpenRecord.date)} · 전날 출근 ${formatTimeLabel(item.previousDayOpenRecord.clockInAt)} / 예상 퇴근 ${formatTimeLabel(item.previousDayOpenRecord.expectedClockOutAt)}`;
  }

  if (item.latestFailedAttempt !== null) {
    return `마지막 시도 ${formatTimeLabel(item.latestFailedAttempt.attemptedAt)} · ${cleanSentence(item.latestFailedAttempt.failureReason)}`;
  }

  if (item.manualRequest !== null) {
    const reviewComment =
      item.manualRequest.governingReviewComment === null
        ? null
        : item.manualRequest.governingReviewComment;

    if (reviewComment !== null) {
      return reviewComment;
    }

    return `대상일 ${formatDateLabel(item.manualRequest.date)} · ${formatTimeLabel(item.manualRequest.submittedAt)} 제출`;
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가 일정과 실제 출결이 함께 보여요";
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    return `예상 출근 ${formatTimeLabel(item.expectedWorkday.adjustedClockInAt)} 이후에도 기록이 없어요`;
  }

  if (item.display.flags.includes("late")) {
    return `출근 ${formatTimeLabel(item.todayRecord?.clockInAt ?? null)} · 퇴근 ${formatTimeLabel(item.todayRecord?.clockOutAt ?? null)}`;
  }

  if (item.display.flags.includes("early_leave")) {
    return `출근 ${formatTimeLabel(item.todayRecord?.clockInAt ?? null)} · 조퇴 시각 ${formatTimeLabel(item.todayRecord?.clockOutAt ?? null)}`;
  }

  if (item.display.activeExceptions.includes("absent")) {
    return "오늘 출근 기록이 없어요";
  }

  if (item.todayRecord !== null) {
    return `출근 ${formatTimeLabel(item.todayRecord.clockInAt)} · 퇴근 ${formatTimeLabel(item.todayRecord.clockOutAt)}`;
  }

  return cleanSentence(getDisplaySummary(item.display));
}

function getNextCheckLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return "전날 퇴근 기록 확인";
  }

  if (item.latestFailedAttempt !== null) {
    return "실패한 시도 다시 확인";
  }

  if (item.manualRequest !== null) {
    return "정정 요청 상태 확인";
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가와 출결 비교";
  }

  if (item.display.activeExceptions.includes("not_checked_in")) {
    return "출근 기록 확인";
  }

  if (item.display.flags.includes("late")) {
    return "지각 사유 확인";
  }

  if (item.display.flags.includes("early_leave")) {
    return "조퇴 사유 확인";
  }

  if (item.display.activeExceptions.includes("absent")) {
    return "운영 상태 재확인";
  }

  return "오늘 장부 확인";
}

function getSearchableName(item: TodayItem) {
  return `${item.employee.name} ${item.employee.department}`.toLocaleLowerCase(
    "ko-KR",
  );
}

function getLedgerRowToneClass(item: TodayItem) {
  if (
    item.previousDayOpenRecord !== null ||
    item.display.activeExceptions.includes("not_checked_in") ||
    item.display.activeExceptions.includes("absent")
  ) {
    return "bg-status-danger-soft/28 hover:bg-status-danger-soft/40";
  }

  if (
    item.latestFailedAttempt !== null ||
    item.display.flags.includes("late") ||
    item.display.flags.includes("early_leave") ||
    item.manualRequest !== null
  ) {
    return "bg-status-warning-soft/22 hover:bg-status-warning-soft/34";
  }

  if (item.display.activeExceptions.includes("leave_work_conflict")) {
    return "bg-status-info-soft/38 hover:bg-status-info-soft/50";
  }

  return "";
}

function getContextBadgeLabel(item: TodayItem) {
  if (item.previousDayOpenRecord !== null) {
    return `대상일 ${formatDateLabel(item.previousDayOpenRecord.date)}`;
  }

  if (item.latestFailedAttempt !== null) {
    return formatTimeLabel(item.latestFailedAttempt.attemptedAt);
  }

  if (item.manualRequest !== null) {
    return `대상일 ${formatDateLabel(item.manualRequest.date)}`;
  }

  return item.expectedWorkday.leaveCoverage !== null ? "휴가 반영" : "오늘";
}

function TodayQueueRow({
  isSelected,
  item,
  onSelect,
}: {
  isSelected: boolean;
  item: TodayItem;
  onSelect: (employeeId: string) => void;
}) {
  const badges = getItemBadges(item);

  return (
    <Button
      aria-label={item.employee.name}
      className={cn(
        "h-auto w-full justify-start rounded-[12px] border border-border/70 px-3 py-2.5 text-left",
        isSelected
          ? "border-primary/30 bg-primary/8 text-foreground hover:bg-primary/10"
          : "bg-background/80 hover:bg-surface-subtle",
      )}
      size="sm"
      type="button"
      variant={isSelected ? "secondary" : "ghost"}
      onClick={() => onSelect(item.employee.id)}
    >
      <span className="flex w-full flex-col gap-2">
        <span className="flex items-start justify-between gap-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {item.employee.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.employee.department}
            </span>
          </span>
          {isSelected ? (
            <Badge variant="outline">선택됨</Badge>
          ) : (
            <Badge variant="ghost">{getContextBadgeLabel(item)}</Badge>
          )}
        </span>
        <span className="text-sm leading-6 text-secondary">
          {getContextLabel(item)}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <Badge
              key={`${item.employee.id}-${badge.label}`}
              className={getBadgeClassName(badge.tone)}
            >
              {badge.label}
            </Badge>
          ))}
        </span>
      </span>
    </Button>
  );
}

function BriefingRow({
  name,
  onNameChange,
  visibleItemCount,
  visibleQueueCount,
}: {
  name?: string;
  onNameChange?: (name: string) => void;
  visibleItemCount: number;
  visibleQueueCount: number;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">오늘 전체팀</Badge>
            <span className="text-xs text-muted-foreground">
              {visibleItemCount}명 표시 중
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle>오늘 운영 브리핑</CardTitle>
            <CardDescription>
              예외부터 보고, 전체 팀 장부에서 사람을 바로 찾아요
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-attendance-name-search">이름 검색</Label>
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="off"
                id="admin-attendance-name-search"
                className="pl-9"
                name="name"
                placeholder="이름이나 부서로 찾아요…"
                type="search"
                value={name ?? ""}
                onChange={(event) => {
                  onNameChange?.(event.target.value);
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>이름을 입력하면 예외 카드와 장부가 함께 좁혀져요</span>
            <Badge variant="outline">{visibleItemCount}명</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-primary text-white shadow-[0_12px_24px_rgba(79,70,229,0.24)]">
        <CardHeader className="flex-row items-start justify-between gap-4 pb-0">
          <div className="flex size-10 items-center justify-center rounded-full bg-white/12">
            <UsersIcon aria-hidden="true" className="size-4" />
          </div>
          <Badge
            className="border-white/20 bg-white/10 text-white"
            variant="outline"
          >
            오늘 큐
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium tracking-[0.08em] text-white/70 uppercase">
              오늘 큐
            </p>
            <p className="text-[32px] font-bold tracking-[-0.04em] text-white tabular-nums">
              {visibleQueueCount}
            </p>
          </div>
          <p className="text-sm leading-6 text-white/75">
            전날 미퇴근, 시도 실패, 정정 요청, 운영 행을 합친 오늘 확인 필요
            건수예요
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function LeftExceptionRail({
  groupedItems,
  selectedEmployeeId,
  onSelectEmployee,
  visibleQueueCount,
  hasAnyItems,
}: {
  groupedItems: ReturnType<typeof groupAdminAttendanceTodayRows>;
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
  visibleQueueCount: number;
  hasAnyItems: boolean;
}) {
  const hasQueueRows = Object.values(groupedItems).some(
    (items) => items.length > 0,
  );

  return (
    <section className="flex flex-col gap-4" aria-label="오늘 운영 예외">
      <div className="flex items-center gap-2">
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-4 text-status-danger"
        />
        <h2 className="text-sm font-medium text-foreground text-balance">
          지금 확인할 예외가 있어요
        </h2>
        <Badge className="bg-status-danger-soft text-status-danger">
          {visibleQueueCount}
        </Badge>
      </div>

      {!hasQueueRows ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>
              {hasAnyItems
                ? "오늘 바로 확인할 예외가 없어요"
                : "오늘 바로 확인할 근태가 없어요"}
            </EmptyTitle>
            <EmptyDescription>
              이름 검색 결과에 따라 이 영역이 다시 좁혀질 수 있어요
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {groupMetadata.map((group) => {
            const items = groupedItems[group.key];

            if (items.length === 0) {
              return null;
            }

            return (
              <Card key={group.key} size="sm">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle>{group.title}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {items.map((item) => (
                    <TodayQueueRow
                      key={`${group.key}-${item.employee.id}`}
                      isSelected={selectedEmployeeId === item.employee.id}
                      item={item}
                      onSelect={onSelectEmployee}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getLedgerStateCell(item: TodayItem) {
  const badges = getItemBadges(item);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-foreground">
        {getCurrentStateLabel(item)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((badge) => (
          <Badge
            key={`${item.employee.id}-${badge.label}`}
            className={getBadgeClassName(badge.tone)}
          >
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function getLedgerContextCell(item: TodayItem) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground">{getContextLabel(item)}</p>
      <p className="text-xs text-muted-foreground">{getNextCheckLabel(item)}</p>
    </div>
  );
}

function LedgerPanel({
  name,
  onSelectEmployee,
  selectedEmployeeId,
  visibleItems,
  visibleQueueCount,
  hasAnyItems,
}: {
  name?: string;
  onSelectEmployee: (employeeId: string) => void;
  selectedEmployeeId: string | null;
  visibleItems: TodayItem[];
  visibleQueueCount: number;
  hasAnyItems: boolean;
}) {
  const selectedItem =
    selectedEmployeeId === null
      ? null
      : (visibleItems.find((item) => item.employee.id === selectedEmployeeId) ??
        null);

  return (
    <Card className="scroll-mt-20" id="today-ledger">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>전체 팀 장부</CardTitle>
          <Badge variant="outline">{visibleItems.length}명</Badge>
        </div>
        <CardDescription>
          오늘은 전체 팀을 그대로 보고, 이름 검색으로 좁혀서 확인해요
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {selectedItem === null ? null : (
          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{selectedItem.employee.name}</CardTitle>
                <Badge variant="outline">
                  {selectedItem.employee.department}
                </Badge>
              </div>
              <CardDescription>
                {getCurrentStateLabel(selectedItem)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  현재 상태
                </p>
                <p className="text-sm leading-6 text-foreground">
                  {getCurrentStateLabel(selectedItem)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  사유
                </p>
                <p className="text-sm leading-6 text-foreground">
                  {getContextLabel(selectedItem)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  다음 확인 지점
                </p>
                <p className="text-sm leading-6 text-foreground">
                  {getNextCheckLabel(selectedItem)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {visibleItems.length === 0 ? (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyTitle>
                {hasAnyItems
                  ? "검색 결과가 없어요"
                  : "오늘 바로 확인할 근태가 없어요"}
              </EmptyTitle>
              <EmptyDescription>
                {hasAnyItems
                  ? "다른 이름으로 찾아보거나 검색어를 지워 주세요"
                  : "지금은 전체 팀 장부에 표시할 항목이 없어요"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>직원</TableHead>
                <TableHead>현재 상태</TableHead>
                <TableHead>출근</TableHead>
                <TableHead>퇴근</TableHead>
                <TableHead>다음 확인</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item) => {
                const isSelected = item.employee.id === selectedEmployeeId;

                return (
                  <TableRow
                    key={item.employee.id}
                    aria-selected={isSelected}
                    className={cn(
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                      getLedgerRowToneClass(item),
                      isSelected &&
                        "bg-primary/8 hover:bg-primary/10 data-[state=selected]:bg-primary/8",
                    )}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => onSelectEmployee(item.employee.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") {
                        return;
                      }

                      event.preventDefault();
                      onSelectEmployee(item.employee.id);
                    }}
                    tabIndex={0}
                  >
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {item.employee.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.employee.department}
                        </span>
                        <span className="text-xs leading-5 text-secondary">
                          {getContextLabel(item)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {getLedgerStateCell(item)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                      {formatTimeLabel(item.todayRecord?.clockInAt ?? null)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-foreground tabular-nums">
                      {formatTimeLabel(item.todayRecord?.clockOutAt ?? null)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {getLedgerContextCell(item)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          전체 {visibleItems.length}명 중 {visibleQueueCount}건이 오늘 큐예요
        </span>
        <span>
          {name === undefined || name.trim().length === 0
            ? "검색어 없음"
            : `검색어 ${name}`}
        </span>
      </CardFooter>
    </Card>
  );
}

export function AdminAttendanceTodayView({
  name,
  onNameChange,
  response,
}: AdminAttendanceTodayViewProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );

  const trimmedName = name?.trim() ?? "";
  const normalizedName = trimmedName.toLocaleLowerCase("ko-KR");
  const visibleItems =
    normalizedName.length === 0
      ? response.items
      : response.items.filter((item) =>
          getSearchableName(item).includes(normalizedName),
        );
  const visibleQueueItems = visibleItems.filter(isTodayQueueItem);
  const groupedItems = groupAdminAttendanceTodayRows(visibleQueueItems);
  const visibleQueueCount = visibleQueueItems.length;

  return (
    <div className="flex flex-col gap-6">
      <BriefingRow
        name={name}
        onNameChange={onNameChange}
        visibleItemCount={visibleItems.length}
        visibleQueueCount={visibleQueueCount}
      />

      <AdminAttendanceSummaryCards summary={response.summary} />

      <section className="grid gap-6 xl:grid-cols-[minmax(320px,317px)_minmax(0,1fr)]">
        <LeftExceptionRail
          groupedItems={groupedItems}
          hasAnyItems={response.items.length > 0}
          selectedEmployeeId={selectedEmployeeId}
          visibleQueueCount={visibleQueueCount}
          onSelectEmployee={setSelectedEmployeeId}
        />
        <LedgerPanel
          hasAnyItems={response.items.length > 0}
          name={name}
          onSelectEmployee={setSelectedEmployeeId}
          selectedEmployeeId={selectedEmployeeId}
          visibleItems={visibleItems}
          visibleQueueCount={visibleQueueCount}
        />
      </section>
    </div>
  );
}
