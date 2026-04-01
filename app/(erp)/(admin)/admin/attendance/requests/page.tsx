import { PageRouteStub } from "@/components/shell/page-route-stub";

export default function AdminRequestManagementPage() {
  return (
    <PageRouteStub
      eyebrow="Admin"
      title="Request management"
      description="This route boundary is ready for admin request review, queue views, and confirmation flows."
      route="/admin/attendance/requests"
    />
  );
}
