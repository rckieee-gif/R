import { z } from 'zod';

export const dailyLogSchema = z.object({
  batchId: z.coerce.number().int().positive("Batch ID must be positive"),
  date: z.string().min(1, "Date is required"),
  building: z.string().min(1, "Building is required"),
  employeeId: z.coerce.number().int().positive("Employee ID is required"),
  handledBirds: z.coerce.number().int().nonnegative("Handled birds count cannot be negative").optional().nullable(),
  feedItemId: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? null : Number(val),
    z.number().int().positive().nullable().optional()
  ),
  feed: z.coerce.number().nonnegative("Feed quantity must be 0 or greater"),
  mortality: z.coerce.number().int().nonnegative("Mortality count must be 0 or greater"),
  averageWeightGrams: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? null : Number(val),
    z.number().positive("Average weight must be greater than zero").nullable().optional()
  ),
  remarks: z.string().optional().nullable()
});
