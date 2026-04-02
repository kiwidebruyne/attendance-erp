import { AttendancePageClient } from "@/app/(erp)/(employee)/attendance/_components/attendance-page-client";
import { getAttendancePageData } from "@/lib/attendance/page-data";

type AttendancePageProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

export default async function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  const { view } = await searchParams;
  const pageData = getAttendancePageData({
    view,
  });

  return <AttendancePageClient initialData={pageData} />;
}
