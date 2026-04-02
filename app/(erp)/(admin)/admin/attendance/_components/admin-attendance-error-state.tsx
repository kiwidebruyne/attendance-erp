"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type AdminAttendanceErrorStateProps = {
  onRetry: () => void;
};

export function AdminAttendanceErrorState({
  onRetry,
}: AdminAttendanceErrorStateProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-secondary uppercase">
          Admin
        </p>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            팀 근태 대시보드
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            오늘 운영 상태와 최근 이력을 한 화면에서 확인해요.
          </p>
        </div>
      </header>

      <Alert variant="destructive">
        <AlertTitle>관리자 근태 화면을 불러오지 못했어요.</AlertTitle>
        <AlertDescription>
          잠시 후 다시 시도하면 최신 상태를 다시 확인할 수 있어요.
        </AlertDescription>
      </Alert>

      <div>
        <Button onClick={onRetry} type="button">
          다시 시도
        </Button>
      </div>
    </div>
  );
}
