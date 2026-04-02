import {
  AlertCircleIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  Clock3Icon,
  FileWarningIcon,
} from "lucide-react";

import { AttendanceSharedSheet } from "@/app/(erp)/(employee)/attendance/_components/attendance-shared-sheet";
import {
  formatAttendanceDate,
  formatAttendanceException,
  formatAttendanceFlag,
  formatAttendancePhase,
  formatAttendanceTime,
  formatNextAction,
  formatWorkMinutes,
  formatWorkWindow,
} from "@/app/(erp)/(employee)/attendance/_lib/format";
import type { AttendanceManualRequestDraft } from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import {
  type AttendanceSheetState,
  type AttendanceSurfaceModel,
  buildExceptionSurfaceModels,
  buildHistoryAction,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  AttendanceHistoryView,
  AttendancePageData,
} from "@/lib/attendance/page-data";

type AttendancePageScreenProps = {
  data: AttendancePageData;
  isSubmitting: boolean;
  mutationError: string | null;
  onCloseSheet: () => void;
  onEditPendingRequest: () => void;
  onOpenSheet: (surface: AttendanceSurfaceModel) => void;
  onResubmitRequest: () => void;
  onSubmit: (draft: AttendanceManualRequestDraft) => void;
  onViewChange: (view: AttendanceHistoryView) => void;
  onWithdrawPendingRequest: () => void;
  sheetState: AttendanceSheetState | null;
};

function TodayStatusCard({ data }: Pick<AttendancePageScreenProps, "data">) {
  return (
    <Card className="h-full border-border/80 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {formatAttendanceDate(data.today.date)}
          </Badge>
          <Badge>{formatAttendancePhase(data.today.display.phase)}</Badge>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl">오늘 근태</CardTitle>
          <CardDescription>
            조정된 근무 시간과 현재 상태를 먼저 확인하고, 필요한 정정 흐름은
            상단 안내에서 이어서 진행해요.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            조정된 근무 시간
          </p>
          <p className="text-lg font-semibold text-foreground">
            {formatWorkWindow(data.today.expectedWorkday)}
          </p>
          {data.today.expectedWorkday.leaveCoverage !== null ? (
            <p className="text-sm leading-6 text-muted-foreground">
              승인된 휴가가 반영된 근무 시간이 표시돼요.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 rounded-lg border border-border/70 bg-card p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            오늘 기록
          </p>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-muted-foreground">출근</dt>
              <dd className="font-medium text-foreground">
                {formatAttendanceTime(
                  data.today.todayRecord?.clockInAt ?? null,
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">퇴근</dt>
              <dd className="font-medium text-foreground">
                {formatAttendanceTime(
                  data.today.todayRecord?.clockOutAt ?? null,
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">누적 시간</dt>
              <dd className="font-medium text-foreground">
                {formatWorkMinutes(data.today.todayRecord?.workMinutes ?? null)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">다음 안내</dt>
              <dd className="font-medium text-foreground">
                {formatNextAction(data.today.display)}
              </dd>
            </div>
          </dl>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-3 border-t border-border/70 bg-muted/30">
        <div className="flex flex-wrap items-center gap-2">
          {data.today.display.flags.map((flag) => (
            <Badge key={flag} variant="outline">
              {formatAttendanceFlag(flag)}
            </Badge>
          ))}
          {data.today.display.activeExceptions.map((exception) => (
            <Badge key={exception} variant="outline">
              {formatAttendanceException(exception, data.today.manualRequest)}
            </Badge>
          ))}
          {data.today.display.flags.length === 0 &&
          data.today.display.activeExceptions.length === 0 ? (
            <Badge variant="outline">정상 흐름</Badge>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          오늘 카드에서는 현재 상태만 요약하고, 실제 정정이나 검토 흐름은 오른쪽
          예외 안내와 같은 공용 시트에서 처리해요.
        </p>
      </CardFooter>
    </Card>
  );
}

function ExceptionStack({
  data,
  onOpenSheet,
}: Pick<AttendancePageScreenProps, "data" | "onOpenSheet">) {
  const surfaces = buildExceptionSurfaceModels(data.today);

  if (surfaces.length === 0) {
    return (
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-secondary">
            <ClipboardListIcon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium">현재 예외 안내</span>
          </div>
          <CardTitle>지금 바로 확인할 예외가 없어요.</CardTitle>
          <CardDescription>
            새로운 문제나 검토 결과가 생기면 이 위치에서 먼저 안내해요.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {surfaces.map((surface) => (
        <Alert
          key={surface.id}
          className="border-border/80 bg-card shadow-sm"
          variant={surface.tone === "destructive" ? "destructive" : "default"}
        >
          {surface.id === "previous-day-checkout-missing" ? (
            <CalendarClockIcon aria-hidden="true" className="size-4" />
          ) : surface.id.startsWith("attempt-failed") ? (
            <FileWarningIcon aria-hidden="true" className="size-4" />
          ) : (
            <AlertCircleIcon aria-hidden="true" className="size-4" />
          )}
          <AlertTitle>{surface.title}</AlertTitle>
          <AlertDescription>{surface.description}</AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenSheet(surface)}
            >
              {surface.ctaLabel}
            </Button>
          </AlertAction>
        </Alert>
      ))}
    </div>
  );
}

function HistorySection({
  data,
  isSubmitting,
  onOpenSheet,
  onViewChange,
}: Pick<
  AttendancePageScreenProps,
  "data" | "isSubmitting" | "onOpenSheet" | "onViewChange"
>) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-secondary">
            <Clock3Icon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium">근태 이력</span>
          </div>
          <CardTitle>
            최근 {data.view === "week" ? "7일" : "30일"} 기록
          </CardTitle>
          <CardDescription>
            사실 기반 이력을 먼저 보고, 필요한 날짜만 같은 공용 시트로 다시 열
            수 있어요.
          </CardDescription>
        </div>
        <ToggleGroup
          disabled={isSubmitting}
          type="single"
          value={data.view}
          onValueChange={(value) => {
            if (value === "" || value === data.view) {
              return;
            }

            onViewChange(value as AttendanceHistoryView);
          }}
        >
          <ToggleGroupItem value="week">7일</ToggleGroupItem>
          <ToggleGroupItem value="month">30일</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>예정 시간</TableHead>
              <TableHead>실제 기록</TableHead>
              <TableHead>근무 시간</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.history.records.map((record) => {
              const historyAction = buildHistoryAction(record);

              return (
                <TableRow key={record.date}>
                  <TableCell className="font-medium text-foreground">
                    {formatAttendanceDate(record.date)}
                  </TableCell>
                  <TableCell>
                    {formatWorkWindow(record.expectedWorkday)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p>
                        출근{" "}
                        {formatAttendanceTime(record.record?.clockInAt ?? null)}
                      </p>
                      <p>
                        퇴근{" "}
                        {formatAttendanceTime(
                          record.record?.clockOutAt ?? null,
                        )}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatWorkMinutes(record.record?.workMinutes ?? null)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {record.display.flags.map((flag) => (
                        <Badge key={`${record.date}-${flag}`} variant="outline">
                          {formatAttendanceFlag(flag)}
                        </Badge>
                      ))}
                      {record.display.activeExceptions.map((exception) => (
                        <Badge
                          key={`${record.date}-${exception}`}
                          variant="outline"
                        >
                          {formatAttendanceException(exception, null)}
                        </Badge>
                      ))}
                      {record.display.flags.length === 0 &&
                      record.display.activeExceptions.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          이상 없음
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {historyAction === null ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenSheet(historyAction)}
                      >
                        {historyAction.label}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AttendancePageScreen({
  data,
  isSubmitting,
  mutationError,
  onCloseSheet,
  onEditPendingRequest,
  onOpenSheet,
  onResubmitRequest,
  onSubmit,
  onViewChange,
  onWithdrawPendingRequest,
  sheetState,
}: AttendancePageScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-secondary uppercase">
          직원
        </p>
        <div className="space-y-1">
          <h1 className="text-pretty text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            근태
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            오늘 상태를 먼저 확인하고, 필요한 정정 요청과 검토 결과는 같은
            시트에서 이어서 처리해요.
          </p>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <TodayStatusCard data={data} />
        <ExceptionStack data={data} onOpenSheet={onOpenSheet} />
      </section>

      <HistorySection
        data={data}
        isSubmitting={isSubmitting}
        onOpenSheet={onOpenSheet}
        onViewChange={onViewChange}
      />

      <AttendanceSharedSheet
        errorMessage={mutationError}
        isSubmitting={isSubmitting}
        state={sheetState}
        onClose={onCloseSheet}
        onEditPendingRequest={onEditPendingRequest}
        onResubmitRequest={onResubmitRequest}
        onSubmit={onSubmit}
        onWithdrawPendingRequest={onWithdrawPendingRequest}
      />
    </div>
  );
}
