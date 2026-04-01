import { PageRouteStub } from "@/components/shell/page-route-stub";

export default function AttendancePage() {
  return (
    <PageRouteStub
      eyebrow="Employee"
      title="My attendance"
      description="This route boundary is ready for the employee attendance overview and its in-page controls."
      route="/attendance"
    />
  );
}
