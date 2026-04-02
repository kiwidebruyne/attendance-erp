import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </header>

      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-[12px]" />
        <Skeleton className="h-10 w-20 rounded-[12px]" />
        <Skeleton className="h-10 w-20 rounded-[12px]" />
      </div>

      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section
          key={sectionIndex}
          className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1fr)_minmax(540px,620px)]"
        >
          <Card>
            <CardHeader className="gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>

              <div className="rounded-[14px] border border-border/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 3 }).map((__, index) => (
                      <Skeleton key={index} className="h-7 w-28 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="h-9 w-24 rounded-[12px]" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((__, index) => (
                  <Skeleton
                    key={index}
                    className="h-10 w-full rounded-[12px]"
                  />
                ))}
              </div>
              {Array.from({ length: 4 }).map((__, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-[14px]" />
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Skeleton className="min-h-[360px] w-full rounded-[16px]" />
            <Skeleton className="min-h-[220px] w-full rounded-[16px]" />
          </div>
        </section>
      ))}
    </div>
  );
}
