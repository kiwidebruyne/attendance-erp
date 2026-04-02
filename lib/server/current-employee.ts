import { createRequestLogger } from "@/lib/server/logger";

export const currentEmployeeId = "emp_001" as const;

export function getCurrentEmployeeId() {
  return currentEmployeeId;
}

export function createEmployeeRequestLogger(request: Request) {
  return createRequestLogger(request, {
    bindings: {
      employeeId: getCurrentEmployeeId(),
    },
  });
}
