import { createSeedRepository } from "@/lib/repositories";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";

function cloneSeedWorld(source: CanonicalSeedWorld = canonicalSeedWorld) {
  return structuredClone(source) as CanonicalSeedWorld;
}

let mockSeedWorld = cloneSeedWorld();
let mockLeaveSuppressionState: Readonly<Record<string, readonly string[]>> = {};

export function getMockSeedWorld() {
  return mockSeedWorld;
}

export function getMockLeaveSuppressionState() {
  return mockLeaveSuppressionState;
}

export function createMockSeedRepository() {
  return createSeedRepository({
    world: getMockSeedWorld(),
    suppressionRequestIdsByEmployeeId: getMockLeaveSuppressionState(),
  });
}

export function resetMockSeedWorldForTests() {
  mockSeedWorld = cloneSeedWorld();
  mockLeaveSuppressionState = {};
}

export function setMockSeedWorldForTests(world: CanonicalSeedWorld) {
  mockSeedWorld = cloneSeedWorld(world);
}

export function setMockLeaveSuppressionStateForTests(
  suppressionState: Readonly<Record<string, readonly string[]>>,
) {
  mockLeaveSuppressionState = structuredClone(suppressionState) as Readonly<
    Record<string, readonly string[]>
  >;
}
