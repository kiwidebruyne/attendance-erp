import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";

export const adminAttendanceBaselineDate = canonicalSeedWorld.baselineDate;

export const adminAttendanceRepository = createSeedRepository({
  world: canonicalSeedWorld,
});
