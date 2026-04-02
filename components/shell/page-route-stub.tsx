import type { Route } from "next";

type PageRouteStubProps = {
  description: string;
  eyebrow: string;
  route: Route;
  title: string;
};

export function PageRouteStub({
  description,
  eyebrow,
  route,
  title,
}: PageRouteStubProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-secondary uppercase">
          {eyebrow}
        </p>
        <div className="space-y-1">
          <h1 className="text-pretty text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            {description}
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-2.5 rounded-full bg-primary"
            />
            <p className="text-sm font-medium text-card-foreground">
              Route boundary ready
            </p>
          </div>

          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-[0.82rem] text-foreground">
              {route}
            </code>{" "}
            now renders inside the shared ERP shell. Feature-specific content
            will land in follow-up issues so this screen can stay neutral for
            downstream implementation.
          </p>
        </div>
      </section>
    </div>
  );
}
