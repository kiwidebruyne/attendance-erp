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
    <div className="flex flex-1 flex-col gap-8">
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          팀 근태 운영
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          오늘 바로 확인할 운영 이슈를 먼저 보고, 필요한 이력은 같은 화면에서
          이어서 비교해요
        </p>
      </header>

      <Alert variant="destructive">
        <AlertTitle>팀 근태 화면을 불러오지 못했어요</AlertTitle>
        <AlertDescription>
          잠시 후 다시 시도하면 최신 운영 상태를 다시 확인할 수 있어요
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
