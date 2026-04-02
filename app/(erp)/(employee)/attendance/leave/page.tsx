import { LeavePageClient } from "@/app/(erp)/(employee)/attendance/leave/_components/leave-page-client";
import { getLeavePageData } from "@/app/(erp)/(employee)/attendance/leave/_lib/page-data";

type LeaveRequestPageProps = {
  searchParams: Promise<{
    date?: string | string[];
  }>;
};

export default async function LeaveRequestPage({
  searchParams,
}: LeaveRequestPageProps) {
  const { date } = await searchParams;
  const pageData = getLeavePageData({
    date,
  });

  return <LeavePageClient initialData={pageData} />;
}
