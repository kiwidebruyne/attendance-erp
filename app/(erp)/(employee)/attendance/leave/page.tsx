import { PageRouteStub } from "@/components/shell/page-route-stub";

export default function LeaveRequestPage() {
  return (
    <PageRouteStub
      eyebrow="Employee"
      title="Leave request"
      description="This route boundary is ready for leave workflows, balances, and request history inside the shared shell."
      route="/attendance/leave"
    />
  );
}
