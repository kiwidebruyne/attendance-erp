"use client";

import {
  BellIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  Clock3Icon,
  FileTextIcon,
  LayoutDashboardIcon,
  MailIcon,
  MenuIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type ComponentType, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    label: "직원",
    items: [
      {
        href: "/attendance",
        icon: Clock3Icon,
        label: "내 근태",
      },
      {
        href: "/attendance/leave",
        icon: CalendarDaysIcon,
        label: "휴가 신청",
      },
    ],
  },
  {
    label: "관리자",
    items: [
      {
        href: "/admin/attendance",
        icon: LayoutDashboardIcon,
        label: "팀 근태",
      },
      {
        href: "/admin/attendance/requests",
        icon: FileTextIcon,
        label: "요청 관리",
      },
    ],
  },
];

function isNavItemActive(pathname: string, href: Route) {
  return pathname === href;
}

function getRoleLabel(pathname: string) {
  return pathname.startsWith("/admin") ? "관리자" : "직원";
}

function getRoleDescription(pathname: string) {
  return pathname.startsWith("/admin") ? "시스템 관리자" : "근태 사용자";
}

type ShellSidebarNavProps = {
  isMobile?: boolean;
  isCollapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  pathname: string;
};

function ShellSidebarNav({
  isMobile = false,
  isCollapsed = false,
  onNavigate,
  onToggleCollapse,
  pathname,
}: ShellSidebarNavProps) {
  const roleLabel = getRoleLabel(pathname);
  const roleDescription = getRoleDescription(pathname);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground",
        isMobile ? "w-full" : isCollapsed ? "w-[56px]" : "w-[200px]",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-start border-b border-white/10 pt-2",
          isCollapsed ? "justify-end px-2" : "justify-between px-4",
        )}
      >
        {!isCollapsed ? (
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[14px] font-semibold tracking-[-0.03em] text-white">
              베스트슬립
            </p>
            <p className="truncate text-[10px] font-medium text-white/52">
              전사 관리 시스템
            </p>
          </div>
        ) : null}
        {onToggleCollapse ? (
          <Button
            aria-controls="erp-sidebar"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className={cn(
              "shrink-0 text-white hover:bg-white/10 hover:text-white",
              isCollapsed && "size-9",
            )}
            onClick={onToggleCollapse}
            size="icon-sm"
            variant="ghost"
          >
            {isCollapsed ? <MenuIcon /> : <ChevronLeftIcon />}
          </Button>
        ) : null}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col overflow-y-auto py-4",
          isCollapsed ? "gap-4 px-2" : "gap-5 px-3",
        )}
      >
        {ERP_NAV_SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-2">
            {!isCollapsed ? (
              <p className="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
                {section.label}
              </p>
            ) : null}
            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center rounded-[10px] py-2.5 text-[13px] font-medium transition-colors",
                      isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                      isActive
                        ? "bg-shell-sidebar-strong text-white"
                        : "text-white/75 hover:bg-white/5 hover:text-white",
                    )}
                    href={item.href}
                    onClick={onNavigate}
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                    <span className={cn(isCollapsed && "sr-only")}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!isCollapsed ? (
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-medium text-white">
              {roleLabel.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-white">
                {roleLabel}
              </p>
              <p className="truncate text-[10px] text-white/60">
                {roleDescription}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ErpShellFrame({
  children,
  pathname,
}: Readonly<{
  children: ReactNode;
  pathname: string;
}>) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const roleLabel = getRoleLabel(pathname);
  const desktopSidebarWidth = desktopSidebarCollapsed ? 56 : 200;

  return (
    <div className="min-h-svh bg-shell-canvas text-foreground">
      <a
        className="sr-only fixed top-4 left-4 z-50 rounded-xl bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="#main-content"
      >
        Skip to main content
      </a>

      <aside
        id="erp-sidebar"
        className="fixed inset-y-0 left-0 hidden overflow-hidden transition-[width] duration-200 lg:block"
        style={{ width: desktopSidebarWidth }}
      >
        <ShellSidebarNav
          isCollapsed={desktopSidebarCollapsed}
          onToggleCollapse={() => setDesktopSidebarCollapsed((value) => !value)}
          pathname={pathname}
        />
      </aside>

      <div
        className={cn(
          "flex min-h-svh flex-col transition-[padding-left] duration-200",
          desktopSidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[200px]",
        )}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-shell-topbar/95 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                aria-label="메뉴 열기"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                size="icon-sm"
                variant="ghost"
              >
                <MenuIcon />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-1 sm:flex">
                <Button aria-label="안내" size="icon-sm" variant="ghost">
                  <span className="text-[13px] font-semibold text-secondary">
                    ?
                  </span>
                </Button>
                <Button aria-label="메일" size="icon-sm" variant="ghost">
                  <MailIcon />
                </Button>
                <Button aria-label="알림" size="icon-sm" variant="ghost">
                  <BellIcon />
                </Button>
              </div>

              <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-5">
                <div className="flex size-8 items-center justify-center rounded-full bg-action-strong text-[11px] font-medium text-white">
                  {roleLabel.slice(0, 1)}
                </div>
                <span className="text-[13px] font-medium text-foreground">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main
          className="flex flex-1 flex-col px-4 pb-8 pt-6 lg:px-8 lg:pt-8"
          id="main-content"
        >
          {children}
        </main>
      </div>

      <Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
        <SheetContent
          className="w-[280px] overscroll-contain border-r border-border p-0 sm:max-w-none"
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>주요 탐색</SheetTitle>
            <SheetDescription>
              베스트슬립 근태 ERP 화면 사이를 이동합니다
            </SheetDescription>
          </SheetHeader>
          <ShellSidebarNav
            isMobile
            onNavigate={() => setMobileNavOpen(false)}
            pathname={pathname}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
