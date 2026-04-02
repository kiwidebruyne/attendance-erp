import { createSeedRepository } from "@/lib/repositories";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";

function cloneSeedWorld(source: CanonicalSeedWorld = canonicalSeedWorld) {
  return structuredClone(source) as CanonicalSeedWorld;
}

let mockSeedWorld = cloneSeedWorld();

export function getMockSeedWorld() {
  return mockSeedWorld;
}

export function createMockSeedRepository() {
  return createSeedRepository({
    world: getMockSeedWorld(),
  });
}

export function resetMockSeedWorldForTests() {
  mockSeedWorld = cloneSeedWorld();
}

export function setMockSeedWorldForTests(world: CanonicalSeedWorld) {
  mockSeedWorld = cloneSeedWorld(world);
}
