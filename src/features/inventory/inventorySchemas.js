import { z } from 'zod';

export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  category: z.enum(['Feed', 'Medicine', 'Supplies', 'Equipment', 'Chicks'], {
    errorMap: () => ({ message: "Category must be one of: Feed, Medicine, Supplies, Equipment, Chicks" })
  }),
  unit: z.string().min(1, "Unit is required"),
  targetQuantity: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? null : Number(val),
    z.number().nonnegative("Target quantity must be 0 or greater").nullable().optional()
  ),
  reorderLevel: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? null : Number(val),
    z.number().nonnegative("Reorder level must be 0 or greater").nullable().optional()
  )
});

export const inventoryMovementSchema = z.object({
  itemId: z.coerce.number().int().positive("Item ID is required"),
  movementDate: z.string().min(1, "Movement date is required"),
  movementType: z.enum(['Stock In', 'Stock Out', 'Adjustment', 'Transfer'], {
    errorMap: () => ({ message: "Movement type must be one of: Stock In, Stock Out, Adjustment, Transfer" })
  }),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitCost: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? undefined : Number(val),
    z.number().nonnegative("Unit cost cannot be negative").optional()
  ),
  building: z.string().min(1, "Building is required"),
  remarks: z.string().optional().nullable(),
  createLedger: z.boolean().optional(),
  fundingNature: z.string().optional().nullable(),
  ledgerCategory: z.string().optional().nullable(),
  paidBy: z.string().optional().nullable(),
  paidTo: z.string().optional().nullable(),
  reference: z.string().optional().nullable()
});
