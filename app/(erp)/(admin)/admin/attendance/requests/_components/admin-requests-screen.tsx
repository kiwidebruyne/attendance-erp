"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  AdminRequestItem,
  AdminRequestsView,
  LeaveAdminRequestItem,
  ManualAdminRequestItem,
} from "../_lib/formatting";
import type { AdminRequestDetailPanelProps } from "./admin-request-detail-panel";
import { AdminRequestDetailPanel } from "./admin-request-detail-panel";
import type { AdminRequestReviewTableColumn } from "./admin-request-review-table-section";
import { AdminRequestReviewTableSection } from "./admin-request-review-table-section";

type ReviewWorkspaceSectionProps<TItem extends AdminRequestItem> = Readonly<{
  columns: AdminRequestReviewTableColumn<TItem>[];
  description: string;
  detailEmptyTitle: string;
  detailPanelProps: AdminRequestDetailPanelProps | null;
  emptyDescription: string;
  emptyTitle: string;
  items: TItem[];
  onRequestSelect: (requestId: string) => void;
  onResetFilters: () => void;
  selectedRequestId: string | null;
  title: string;
  totalCount: number;
}>;

type AdminRequestsScreenProps = Readonly<{
  errorMessage: string | null;
  hasQueryError: boolean;
  isBusy: boolean;
  leaveSection: ReviewWorkspaceSectionProps<LeaveAdminRequestItem>;
  manualSection: ReviewWorkspaceSectionProps<ManualAdminRequestItem>;
  onViewChange: (view: AdminRequestsView) => void;
  view: AdminRequestsView;
}>;

const tabItems: Array<{ label: string; value: AdminRequestsView }> = [
  { label: "검토 필요", value: "needs_review" },
  { label: "완료", value: "completed" },
  { label: "전체", value: "all" },
];

function EmptyDetailCard({
  title,
}: Readonly<{
  title: string;
}>) {
  return (
    <Card className="min-h-[360px]">
      <CardContent className="flex h-full items-center justify-center">
        <Empty className="border-none bg-transparent">
          <EmptyHeader>
            <EmptyTitle>{title}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}

function ReviewWorkspaceSection<TItem extends AdminRequestItem>({
  columns,
  description,
  detailEmptyTitle,
  detailPanelProps,
  emptyDescription,
  emptyTitle,
  isBusy,
  items,
  onRequestSelect,
  onResetFilters,
  selectedRequestId,
  title,
  totalCount,
}: ReviewWorkspaceSectionProps<TItem> & Readonly<{ isBusy: boolean }>) {
  return (
    <section className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1fr)_minmax(540px,620px)]">
      <AdminRequestReviewTableSection
        columns={columns}
        description={description}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        isBusy={isBusy}
        items={items}
        onRequestSelect={onRequestSelect}
        onResetFilters={onResetFilters}
        selectedRequestId={selectedRequestId}
        title={title}
        totalCount={totalCount}
      />

      {detailPanelProps === null ? (
        <EmptyDetailCard title={detailEmptyTitle} />
      ) : (
        <AdminRequestDetailPanel {...detailPanelProps} />
      )}
    </section>
  );
}

export function AdminRequestsScreen({
  errorMessage,
  hasQueryError,
  isBusy,
  leaveSection,
  manualSection,
  onViewChange,
  view,
}: AdminRequestsScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <header>
        <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-balance text-foreground">
          요청 관리
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          정정 신청과 휴가 신청을 나눠서 보고 바로 검토해요
        </p>
      </header>

      {hasQueryError && errorMessage !== null ? (
        <Alert variant="destructive">
          <AlertTitle>최신 요청 상태를 다시 불러오지 못했어요</AlertTitle>
          <AlertDescription>
            이전에 받아 둔 내용은 그대로 보여드리고 있어요. 잠시 후 다시
            시도하면 최신 흐름으로 맞춰져요.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        className="gap-5"
        value={view}
        onValueChange={(nextView) => {
          if (nextView === view) {
            return;
          }

          onViewChange(nextView as AdminRequestsView);
        }}
      >
        <TabsList className="rounded-[12px] bg-muted p-1">
          {tabItems.map((item) => (
            <TabsTrigger
              key={item.value}
              className="min-w-[88px]"
              disabled={isBusy}
              value={item.value}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent className="mt-0 flex flex-col gap-8" value={view}>
          <ReviewWorkspaceSection {...manualSection} isBusy={isBusy} />
          <ReviewWorkspaceSection {...leaveSection} isBusy={isBusy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
