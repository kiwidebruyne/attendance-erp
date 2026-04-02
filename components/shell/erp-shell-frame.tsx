import {
  BedDoubleIcon,
  CalendarDaysIcon,
  Clock3Icon,
  FileTextIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type ErpNavItem = {
  href: Route;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

type ErpNavSection = {
  label: string;
  items: ErpNavItem[];
};

const ERP_NAV_SECTIONS: ErpNavSection[] = [
  {
    label: "Employee",
    items: [
      {
        href: "/attendance",
        icon: Clock3Icon,
        label: "My attendance",
      },
      {
        href: "/attendance/leave",
        icon: CalendarDaysIcon,
        label: "Leave request",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/admin/attendance",
        icon: LayoutDashboardIcon,
        label: "Team attendance",
      },
      {
        href: "/admin/attendance/requests",
        icon: FileTextIcon,
        label: "Request management",
      },
    ],
  },
];

type ErpSidebarNavProps = {
  pathname: string;
};

function ErpSidebarNav({ pathname }: ErpSidebarNavProps) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/80 px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/70 px-3 py-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <BedDoubleIcon aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              BestSleep
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              Attendance ERP
            </p>
          </div>
        </div>
        <p className="px-1 text-xs leading-5 text-sidebar-foreground/70">
          Shared assignment navigation for employee and admin attendance routes.
        </p>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {ERP_NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label} className="px-1 py-0">
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          aria-current={isActive ? "page" : undefined}
                          href={item.href}
                        >
                          <item.icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function ErpShellFrame({
  children,
  pathname,
}: Readonly<{
  children: ReactNode;
  pathname: string;
}>) {
  return (
    <SidebarProvider defaultOpen>
      <a
        className="sr-only fixed top-4 left-4 z-50 rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="#main-content"
      >
        Skip to main content
      </a>

      <ErpSidebarNav pathname={pathname} />

      <SidebarInset className="min-h-svh bg-background" id="main-content">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium tracking-[0.14em] text-secondary uppercase">
              Shared shell
            </p>
            <p className="truncate text-sm font-medium text-foreground">
              BestSleep attendance ERP
            </p>
          </div>
        </header>

        <div
          className={cn(
            "flex flex-1 flex-col px-4 py-6 md:px-8",
            "bg-linear-to-b from-background via-background to-muted/20",
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
