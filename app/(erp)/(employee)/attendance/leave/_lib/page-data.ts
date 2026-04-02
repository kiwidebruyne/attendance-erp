import { apiDateSchema } from "@/lib/contracts/shared";
import { getCurrentEmployeeId } from "@/lib/server/current-employee";
import {
  createMockSeedRepository,
  getMockSeedWorld,
} from "@/lib/server/mock-state";

export type LeavePageData = Readonly<{
  baselineDate: string;
  selectedDate: string;
  overview: ReturnType<
    ReturnType<typeof createMockSeedRepository>["getEmployeeLeaveOverview"]
  >;
}>;

function parseSelectedDate(
  date: string | string[] | undefined,
  fallbackDate: string,
) {
  if (typeof date !== "string") {
    return fallbackDate;
  }

  return apiDateSchema.safeParse(date).success ? date : fallbackDate;
}

export function getLeavePageData(input: {
  date: string | string[] | undefined;
}): LeavePageData {
  const repository = createMockSeedRepository();
  const baselineDate = getMockSeedWorld().baselineDate;
  const selectedDate = parseSelectedDate(input.date, baselineDate);

  return {
    baselineDate,
    selectedDate,
    overview: repository.getEmployeeLeaveOverview({
      employeeId: getCurrentEmployeeId(),
      date: selectedDate,
    }),
  };
}
