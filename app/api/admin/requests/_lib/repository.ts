import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";
import {
  createMockSeedRepository,
  getMockSeedWorld,
} from "@/lib/server/mock-state";

const mockAdminReviewerId = "emp_012" as const;

export function createAdminRequestRepository() {
  return createMockSeedRepository();
}

export function getAdminRequestReviewContext() {
  return {
    reviewedAt: buildFixedSeoulDateTime(
      getMockSeedWorld().baselineDate,
      "12:00:00",
    ),
    reviewerId: mockAdminReviewerId,
  };
}
