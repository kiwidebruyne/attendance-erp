import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";

type TodayItem = AdminAttendanceTodayResponse["items"][number];

type SummaryCard = Readonly<{
  description: string;
  key: string;
  title: string;
  value: number;
}>;

type AdminAttendanceSummaryCardsProps = {
  items: TodayItem[];
};

function buildSummaryCards(items: TodayItem[]): SummaryCard[] {
  return [
    {
      key: "working",
      title: "근무중",
      description: "지금 근무하고 있는 인원",
      value: items.filter((item) => item.display.phase === "working").length,
    },
    {
      key: "before-check-in",
      title: "출근 전",
      description: "아직 출근 전인 인원",
      value: items.filter((item) => item.display.phase === "before_check_in")
        .length,
    },
    {
      key: "late",
      title: "지각",
      description: "지각 플래그가 있는 인원",
      value: items.filter((item) => item.display.flags.includes("late")).length,
    },
    {
      key: "early-leave",
      title: "조퇴",
      description: "조퇴 플래그가 있는 인원",
      value: items.filter((item) => item.display.flags.includes("early_leave"))
        .length,
    },
    {
      key: "annual",
      title: "연차",
      description: "연차가 반영된 인원",
      value: items.filter(
        (item) => item.expectedWorkday.leaveCoverage?.leaveType === "annual",
      ).length,
    },
    {
      key: "half-day",
      title: "반차",
      description: "반차가 반영된 인원",
      value: items.filter((item) => {
        const leaveType = item.expectedWorkday.leaveCoverage?.leaveType;
        return leaveType === "half_am" || leaveType === "half_pm";
      }).length,
    },
    {
      key: "hourly",
      title: "시간차",
      description: "시간차가 반영된 인원",
      value: items.filter(
        (item) => item.expectedWorkday.leaveCoverage?.leaveType === "hourly",
      ).length,
    },
  ];
}

export function AdminAttendanceSummaryCards({
  items,
}: AdminAttendanceSummaryCardsProps) {
  const cards = buildSummaryCards(items);

  return (
    <section aria-label="오늘 요약" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-foreground">오늘 요약</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            검색 결과 기준으로 현재 상태를 바로 비교해요
          </p>
        </div>
        <Badge variant="outline">{items.length}명</Badge>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-3">
          {cards.map((card) => (
            <Card
              key={card.key}
              size="sm"
              className="w-[156px] shrink-0 border-border/80 bg-card/95"
            >
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    {card.title}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {card.description}
                  </p>
                </div>
                <p className="text-[28px] font-bold tracking-[-0.04em] text-foreground tabular-nums">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
