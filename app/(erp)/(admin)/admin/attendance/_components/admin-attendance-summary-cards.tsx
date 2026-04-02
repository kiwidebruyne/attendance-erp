import {
  CalendarClockIcon,
  CalendarDaysIcon,
  Clock3Icon,
  FileWarningIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";

const summaryCards: Array<{
  accentClassName: string;
  icon: typeof Clock3Icon;
  key: keyof AdminAttendanceTodayResponse["summary"];
  title: string;
}> = [
  {
    key: "checkedInCount",
    title: "출근 완료",
    icon: Clock3Icon,
    accentClassName: "bg-status-success-soft text-status-success",
  },
  {
    key: "notCheckedInCount",
    title: "출근 전",
    icon: TriangleAlertIcon,
    accentClassName: "bg-status-danger-soft text-status-danger",
  },
  {
    key: "lateCount",
    title: "지각",
    icon: TriangleAlertIcon,
    accentClassName: "bg-status-warning-soft text-status-warning",
  },
  {
    key: "onLeaveCount",
    title: "휴가",
    icon: CalendarDaysIcon,
    accentClassName: "bg-status-info-soft text-status-info",
  },
  {
    key: "failedAttemptCount",
    title: "출결 시도 실패",
    icon: FileWarningIcon,
    accentClassName: "bg-status-warning-soft text-status-warning",
  },
  {
    key: "previousDayOpenCount",
    title: "전날 미퇴근",
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
    <section
      aria-label="오늘 요약"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {summaryCards.map((card) => (
        <Card key={card.key} size="sm">
          <CardHeader className="gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-full ${card.accentClassName}`}
            >
              <card.icon aria-hidden="true" className="size-4" />
            </div>
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[32px] font-bold tracking-[-0.04em] text-foreground">
              {summary[card.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
