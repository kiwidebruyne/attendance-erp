import type {
  AdminAttendanceListResponse,
  AdminAttendanceTodayResponse,
} from "@/lib/contracts/admin-attendance";
import type {
  AttendanceHistoryResponse,
  AttendanceTodayResponse,
} from "@/lib/contracts/attendance";
import type { LeaveOverviewResponse } from "@/lib/contracts/leave";
import type {
  AdminRequestDecisionBody,
  AdminRequestDecisionResponse,
  AdminRequestsResponse,
} from "@/lib/contracts/requests";
import {
  getAdminAttendanceList,
  getAdminAttendanceToday,
  getEmployeeAttendanceHistory,
  getEmployeeAttendanceToday,
} from "@/lib/repositories/attendance";
import { getEmployeeLeaveOverview } from "@/lib/repositories/leave";
import {
  findRequestChainByRequestId,
  getAdminRequests,
  type RequestChainLookup,
  reviewAdminRequest,
} from "@/lib/repositories/requests";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

type EmployeeEntity = CanonicalSeedWorld["employees"][number];

type GetEmployeeAttendanceTodayInput = Readonly<{
  employeeId: string;
  date: string;
}>;

type GetEmployeeAttendanceHistoryInput = Readonly<{
  employeeId: string;
  from: string;
  to: string;
}>;

type GetEmployeeLeaveOverviewOptions = Readonly<{
  employeeId: string;
  date?: string;
}>;

type GetAdminAttendanceTodayInput = Readonly<{
  date: string;
}>;

type GetAdminAttendanceListInput = Readonly<{
  from: string;
  to: string;
  name?: string;
}>;

type GetAdminRequestsInput = Readonly<{
  view?: "needs_review" | "completed" | "all";
}>;

type ReviewAdminRequestInput = Readonly<{
  requestId: string;
  decision: AdminRequestDecisionBody;
  reviewedAt: string;
  reviewerId: string;
}>;

export type SeedRepository = Readonly<{
  findEmployeeById: (employeeId: string) => EmployeeEntity | null;
  findRequestChainByRequestId: (requestId: string) => RequestChainLookup | null;
  getEmployeeAttendanceToday: (
    input: GetEmployeeAttendanceTodayInput,
  ) => AttendanceTodayResponse;
  getEmployeeAttendanceHistory: (
    input: GetEmployeeAttendanceHistoryInput,
  ) => AttendanceHistoryResponse;
  getEmployeeLeaveOverview: (
    input: GetEmployeeLeaveOverviewOptions,
  ) => LeaveOverviewResponse;
  getAdminAttendanceToday: (
    input: GetAdminAttendanceTodayInput,
  ) => AdminAttendanceTodayResponse;
  getAdminAttendanceList: (
    input: GetAdminAttendanceListInput,
  ) => AdminAttendanceListResponse;
  getAdminRequests: (input?: GetAdminRequestsInput) => AdminRequestsResponse;
  reviewAdminRequest: (
    input: ReviewAdminRequestInput,
  ) => AdminRequestDecisionResponse;
}>;

export type CreateSeedRepositoryOptions = Readonly<{
  world: CanonicalSeedWorld;
  now?: string;
  annualLeaveAllowanceDays?: number;
  suppressionRequestIdsByEmployeeId?: Readonly<
    Record<string, readonly string[]>
  >;
}>;

function buildDefaultNow(world: CanonicalSeedWorld) {
  return `${world.baselineDate}T12:00:00+09:00`;
}

function buildEmployeeIndex(world: CanonicalSeedWorld) {
  return new Map(world.employees.map((employee) => [employee.id, employee]));
}

export function createSeedRepository(
  options: CreateSeedRepositoryOptions,
): SeedRepository {
  const employeeById = buildEmployeeIndex(options.world);
  const now = options.now ?? buildDefaultNow(options.world);
  const annualLeaveAllowanceDays = options.annualLeaveAllowanceDays ?? 15;
  const suppressionRequestIdsByEmployeeId =
    options.suppressionRequestIdsByEmployeeId;

  return Object.freeze({
    findEmployeeById(employeeId) {
      return employeeById.get(employeeId) ?? null;
    },

    findRequestChainByRequestId(requestId) {
      return findRequestChainByRequestId(options.world, requestId);
    },

    getEmployeeAttendanceToday(input) {
      return getEmployeeAttendanceToday(options.world, {
        ...input,
        now,
      });
    },

    getEmployeeAttendanceHistory(input) {
      return getEmployeeAttendanceHistory(options.world, {
        ...input,
        now,
      });
    },

    getEmployeeLeaveOverview(input) {
      return getEmployeeLeaveOverview(options.world, {
        ...input,
        annualLeaveAllowanceDays,
        suppressionRequestIdsByEmployeeId,
      });
    },

    getAdminAttendanceToday(input) {
      return getAdminAttendanceToday(options.world, {
        ...input,
        now,
      });
    },

    getAdminAttendanceList(input) {
      return getAdminAttendanceList(options.world, {
        ...input,
        now,
      });
    },

    getAdminRequests(input = {}) {
      return getAdminRequests(options.world, input);
    },

    reviewAdminRequest(input) {
      return reviewAdminRequest(
        options.world,
        input.requestId,
        input.decision,
        {
          reviewedAt: input.reviewedAt,
          reviewerId: input.reviewerId,
        },
      );
    },
  });
}

export {
  getAdminAttendanceList,
  getAdminAttendanceToday,
  getEmployeeAttendanceHistory,
  getEmployeeAttendanceToday,
} from "@/lib/repositories/attendance";
export { buildLeaveConflictProjection } from "@/lib/repositories/leave";
export { getEmployeeLeaveOverview } from "@/lib/repositories/leave";
export {
  buildRequestChainProjection,
  getAdminRequests,
  reviewAdminRequest,
} from "@/lib/repositories/requests";
