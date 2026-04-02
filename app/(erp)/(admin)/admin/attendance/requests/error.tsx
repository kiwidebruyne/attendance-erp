"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: Readonly<{
  reset: () => void;
}>) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          요청 관리
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          검토가 필요한 요청과 완료된 기록을 같은 작업 흐름에서 이어서 확인해요
        </p>
      </header>

      <Alert variant="destructive">
        <AlertTitle>요청 관리 화면을 불러오지 못했어요</AlertTitle>
        <AlertDescription>
          잠시 후 다시 시도하면 최신 검토 흐름으로 맞춰질 수 있어요
        </AlertDescription>
      </Alert>

      <div>
        <Button onClick={reset} type="button">
          다시 시도
        </Button>
      </div>
    </div>
  );
}
