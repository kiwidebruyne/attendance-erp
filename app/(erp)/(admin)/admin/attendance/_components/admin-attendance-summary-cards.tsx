import {
  CalendarClockIcon,
  CalendarDaysIcon,
  Clock3Icon,
  FileWarningIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";

const summaryCards: Array<{
  accentClassName: string;
  description: string;
  icon: typeof Clock3Icon;
  key: keyof AdminAttendanceTodayResponse["summary"];
  title: string;
}> = [
  {
    key: "checkedInCount",
    title: "출근 완료",
    description: "오늘 출근이 들어온 팀원",
    icon: Clock3Icon,
    accentClassName: "bg-status-success-soft text-status-success",
  },
  {
    key: "notCheckedInCount",
    title: "출근 전",
    description: "아직 출근 기록이 없는 팀원",
    icon: TriangleAlertIcon,
    accentClassName: "bg-status-danger-soft text-status-danger",
  },
  {
    key: "lateCount",
    title: "지각",
    description: "지각으로 잡힌 팀원",
    icon: TriangleAlertIcon,
    accentClassName: "bg-status-warning-soft text-status-warning",
  },
  {
    key: "onLeaveCount",
    title: "휴가",
    description: "오늘 휴가가 반영된 팀원",
    icon: CalendarDaysIcon,
    accentClassName: "bg-status-info-soft text-status-info",
  },
  {
    key: "failedAttemptCount",
    title: "출결 시도 실패",
    description: "비콘 또는 앱 확인이 실패한 시도",
    icon: FileWarningIcon,
    accentClassName: "bg-status-warning-soft text-status-warning",
  },
  {
    key: "previousDayOpenCount",
    title: "전날 미퇴근",
    description: "어제 퇴근 기록이 남아 있는 팀원",
    icon: CalendarClockIcon,
    accentClassName: "bg-status-danger-soft text-status-danger",
  },
];

type AdminAttendanceSummaryCardsProps = {
  summary: AdminAttendanceTodayResponse["summary"];
};

export function AdminAttendanceSummaryCards({
  summary,
}: AdminAttendanceSummaryCardsProps) {
  return (
    <section aria-label="오늘 요약" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-foreground">오늘 요약</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            전체 팀 상태를 한 번에 확인해요
          </p>
        </div>
        <Badge variant="outline">전체 팀 기준</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <Card
            key={card.key}
            size="sm"
            className="border-border/80 bg-card/95"
          >
            <CardHeader className="gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-9 items-center justify-center rounded-full ${card.accentClassName}`}
                >
                  <card.icon aria-hidden="true" className="size-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[32px] font-bold tracking-[-0.04em] text-foreground">
                  {summary[card.key]}
                </p>
                <p className="text-xs text-muted-foreground">명</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
