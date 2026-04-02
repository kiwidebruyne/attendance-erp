import { describe, expect, it } from "vitest";

import { buildAdminAttendanceTodayExceptionRows } from "@/app/(erp)/(admin)/admin/attendance/_lib/today-exception-rows";
import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";

const snapshotNow = "2026-04-13T10:00:00+09:00";

describe("buildAdminAttendanceTodayExceptionRows", () => {
  it("keeps the baseline exception table sparse and focused on operational issues", () => {
    const repository = createSeedRepository({
      world: canonicalSeedWorld,
    });
    const todayResponse = repository.getAdminAttendanceToday({
      date: canonicalSeedWorld.baselineDate,
      now: snapshotNow,
    });

    const rows = buildAdminAttendanceTodayExceptionRows(todayResponse);

    expect(rows.length).toBeLessThanOrEqual(10);
    expect(
      rows.some(
        (row) =>
          row.referenceDate < canonicalSeedWorld.baselineDate &&
          row.exceptionType.includes("지각"),
      ),
    ).toBe(false);
    expect(
      rows.some(
        (row) =>
          row.referenceDate < canonicalSeedWorld.baselineDate &&
          row.exceptionType.includes("조퇴"),
      ),
    ).toBe(false);
  });
});
