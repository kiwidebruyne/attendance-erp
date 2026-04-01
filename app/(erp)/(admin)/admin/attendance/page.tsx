import { PageRouteStub } from "@/components/shell/page-route-stub";

export default function AdminAttendancePage() {
  return (
    <PageRouteStub
      eyebrow="Admin"
      title="Team attendance dashboard"
      description="This route boundary is ready for the admin attendance dashboard and its date-driven exception review."
      route="/admin/attendance"
    />
  );
}
