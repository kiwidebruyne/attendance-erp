"use client";

import { AdminAttendanceErrorState } from "./_components/admin-attendance-error-state";

export default function AdminAttendanceError({ reset }: { reset: () => void }) {
  return <AdminAttendanceErrorState onRetry={reset} />;
}
