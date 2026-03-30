import {
  ArrowRightIcon,
  BellRingIcon,
  Clock3Icon,
  FingerprintIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { FoundationInteractiveShowcase } from "./_components/foundation-interactive-showcase";

const weeklyAttendance = [
  {
    date: "Mon, Mar 30",
    checkIn: "08:57",
    checkOut: "18:11",
    duration: "8h 34m",
    status: "On time",
    variant: "secondary" as const,
  },
  {
    date: "Tue, Mar 31",
    checkIn: "09:14",
    checkOut: "18:03",
    duration: "8h 01m",
    status: "Late",
    variant: "outline" as const,
  },
  {
    date: "Wed, Apr 1",
    checkIn: "08:49",
    checkOut: "17:42",
    duration: "7h 53m",
    status: "Checked out",
    variant: "secondary" as const,
  },
  {
    date: "Thu, Apr 2",
    checkIn: "-",
    checkOut: "-",
    duration: "-",
    status: "Leave",
    variant: "default" as const,
  },
];

const monthlyHighlights = [
  {
    label: "Verified check-ins",
    value: "91%",
    note: "Beacon matched on 22 days",
  },
  {
    label: "Late arrivals",
    value: "4",
    note: "Most often between 09:10 and 09:20",
  },
  { label: "Pending requests", value: "3", note: "2 manual, 1 leave approval" },
];

const statusCards = [
  {
    description: "Beacon verified",
    title: "Checked in at 08:57",
    detail: "Inside the showroom entrance zone",
    icon: FingerprintIcon,
  },
  {
    description: "Review queue",
    title: "3 requests need action",
    detail: "Two are same-day manual check-ins",
    icon: BellRingIcon,
  },
  {
    description: "Schedule health",
    title: "1 early departure this week",
    detail: "No unresolved absences in the latest cycle",
    icon: ShieldCheckIcon,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:px-6">
        <aside className="hidden lg:block">
          <div className="flex h-full flex-col gap-6 rounded-[calc(var(--radius)*2)] bg-sidebar p-5 text-sidebar-foreground ring-1 ring-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
                <FingerprintIcon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs uppercase tracking-[0.24em] text-sidebar-foreground/60">
                  BestSleep
                </span>
                <strong className="text-base font-semibold">
                  Attendance ERP
                </strong>
              </div>
            </div>

            <nav className="flex flex-col gap-1 text-sm">
              <div className="rounded-xl bg-sidebar-accent px-3 py-2 font-medium text-sidebar-accent-foreground">
                My Attendance
              </div>
              <div className="rounded-xl px-3 py-2 text-sidebar-foreground/72">
                Leave Request
              </div>
              <div className="rounded-xl px-3 py-2 text-sidebar-foreground/72">
                Team Dashboard
              </div>
              <div className="rounded-xl px-3 py-2 text-sidebar-foreground/72">
                Request Management
              </div>
            </nav>

            <div className="flex flex-col gap-3 rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/60 p-4">
              <span className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
                Foundation preview
              </span>
              <p className="text-sm leading-6 text-sidebar-foreground/88">
                Shared shadcn/ui primitives are ready for the attendance, leave,
                and admin routes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-sidebar-primary text-sidebar-primary-foreground">
                  Radix
                </Badge>
                <Badge
                  className="bg-sidebar-foreground/12 text-sidebar-foreground"
                  variant="secondary"
                >
                  Tailwind v4
                </Badge>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-6 rounded-[calc(var(--radius)*2)] border border-border/80 bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Issue #9</Badge>
                  <Badge variant="outline">shadcn/ui foundation</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Component foundation for the beacon attendance module
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    The preview below verifies the new shared primitives,
                    typography, and ERP-aligned tokens before the employee and
                    admin flows are built.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button">
                  <FingerprintIcon data-icon="inline-start" />
                  Manual verification
                </Button>
                <Button type="button" variant="outline">
                  <ArrowRightIcon data-icon="inline-start" />
                  Request review
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {statusCards.map(({ description, title, detail, icon: Icon }) => (
                <Card key={title} size="sm">
                  <CardHeader>
                    <CardDescription>{description}</CardDescription>
                    <CardTitle>{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{detail}</p>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <Icon className="size-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
            <Tabs className="gap-4" defaultValue="weekly">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    Attendance activity preview
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Compact table and summary layouts for employee and admin
                    screens.
                  </p>
                </div>
                <TabsList>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="weekly">
                <Card>
                  <CardHeader>
                    <CardDescription>Latest attendance records</CardDescription>
                    <CardTitle>Weekly record table</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyAttendance.map((entry) => (
                          <TableRow key={entry.date}>
                            <TableCell className="font-medium text-foreground">
                              {entry.date}
                            </TableCell>
                            <TableCell>{entry.checkIn}</TableCell>
                            <TableCell>{entry.checkOut}</TableCell>
                            <TableCell>{entry.duration}</TableCell>
                            <TableCell>
                              <Badge variant={entry.variant}>
                                {entry.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="monthly">
                <div className="grid gap-4 md:grid-cols-3">
                  {monthlyHighlights.map((item) => (
                    <Card key={item.label} size="sm">
                      <CardHeader>
                        <CardDescription>{item.label}</CardDescription>
                        <CardTitle>{item.value}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {item.note}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader>
                <CardDescription>Form inputs and button states</CardDescription>
                <CardTitle>Manual attendance request draft</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                    htmlFor="request-date"
                  >
                    Request date
                  </label>
                  <Input id="request-date" readOnly value="2026-03-31" />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                    htmlFor="request-time"
                  >
                    Missing beacon window
                  </label>
                  <Input
                    id="request-time"
                    readOnly
                    value="08:45 - 09:05 near Warehouse Gate A"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                    htmlFor="request-note"
                  >
                    Explanation
                  </label>
                  <Textarea
                    id="request-note"
                    readOnly
                    value="Beacon verification failed while entering through the loading area. Requesting manual confirmation with CCTV cross-check."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button">
                    <Clock3Icon data-icon="inline-start" />
                    Submit request
                  </Button>
                  <Button type="button" variant="outline">
                    <SearchIcon data-icon="inline-start" />
                    View history
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <FoundationInteractiveShowcase />
        </main>
      </div>
    </div>
  );
}
