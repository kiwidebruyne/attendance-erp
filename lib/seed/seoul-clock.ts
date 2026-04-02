export const fixedSeoulTimeZone = "Asia/Seoul" as const;
export const fixedSeoulUtcOffset = "+09:00" as const;
export const fixedSeoulBaselineDate = "2026-04-13" as const;

export const fixedSeoulCalendarWindow = Object.freeze({
  start: "2026-03-23",
  end: "2026-04-20",
} as const);

export function buildFixedSeoulDateTime(date: string, time: string) {
  return `${date}T${time}${fixedSeoulUtcOffset}`;
}
