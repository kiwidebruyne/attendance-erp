import {
  createMockSeedRepository,
  getMockSeedWorld,
} from "@/lib/server/mock-state";

export function getAdminAttendanceBaselineDate() {
  return getMockSeedWorld().baselineDate;
}

export function createAdminAttendanceRepository() {
  return createMockSeedRepository();
}
