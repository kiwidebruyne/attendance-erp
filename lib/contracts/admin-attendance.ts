import { z } from "zod";

import {
  adminAttendanceItemSchema,
  adminAttendanceListRecordSchema,
  apiDateSchema,
} from "@/lib/contracts/shared";

export const adminAttendanceTodayResponseSchema = z.object({
  date: apiDateSchema,
  summary: z.object({
    checkedInCount: z.number(),
    notCheckedInCount: z.number(),
    lateCount: z.number(),
    onLeaveCount: z.number(),
  }),
  items: z.array(adminAttendanceItemSchema),
});

export const adminAttendanceListQuerySchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
  name: z.string().min(1).optional(),
});

export const adminAttendanceListResponseSchema = z.object({
  from: apiDateSchema,
  to: apiDateSchema,
  filters: z.object({
    name: z.string().min(1).optional(),
  }),
  total: z.number(),
  records: z.array(adminAttendanceListRecordSchema),
});

export type AdminAttendanceTodayResponse = z.infer<
  typeof adminAttendanceTodayResponseSchema
>;
export type AdminAttendanceListQuery = z.infer<
  typeof adminAttendanceListQuerySchema
>;
export type AdminAttendanceListResponse = z.infer<
  typeof adminAttendanceListResponseSchema
>;
