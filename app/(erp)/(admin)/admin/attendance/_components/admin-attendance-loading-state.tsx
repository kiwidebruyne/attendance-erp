import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminAttendanceLoadingState() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="space-y-2">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
        <Card>
          <CardContent className="flex flex-col gap-5 xl:flex-row xl:items-center">
            <div className="min-w-[220px] space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-40" />
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Skeleton className="min-h-[176px] w-full rounded-[16px]" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-[16px]" />
          ))}
        </div>

        <Card>
          <CardHeader className="gap-3">
            <CardTitle>
              <Skeleton className="h-5 w-40" />
            </CardTitle>
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-32 w-full rounded-[16px]" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-[12px]" />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
