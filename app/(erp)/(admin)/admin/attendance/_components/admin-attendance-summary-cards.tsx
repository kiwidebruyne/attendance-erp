import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";

const summaryCards: Array<{
  key: keyof AdminAttendanceTodayResponse["summary"];
  title: string;
}> = [
  { key: "checkedInCount", title: "출근 완료" },
  { key: "notCheckedInCount", title: "출근 전" },
  { key: "lateCount", title: "지각" },
  { key: "onLeaveCount", title: "휴가" },
  { key: "failedAttemptCount", title: "출결 시도 실패" },
  { key: "previousDayOpenCount", title: "전날 미퇴근" },
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
          <CardHeader className="gap-0.5">
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {summary[card.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
