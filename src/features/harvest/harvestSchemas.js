import { z } from 'zod';

const chickenSaleSchema = z.object({
  item: z.string().min(1, "Chicken sale item name is required"),
  basePricePerKg: z.coerce.number().nonnegative("Base price per kg must be 0 or greater"),
  harvest1Birds: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().int().nonnegative("Harvest 1 birds count cannot be negative")),
  harvest1Kilos: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 1 kilos cannot be negative")),
  harvest2Birds: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().int().nonnegative("Harvest 2 birds count cannot be negative")),
  harvest2Kilos: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 2 kilos cannot be negative")),
  harvest3Birds: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().int().nonnegative("Harvest 3 birds count cannot be negative")),
  harvest3Kilos: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 3 kilos cannot be negative")),
  finalRate: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().nonnegative("Final rate cannot be negative").optional()),
  notes: z.string().optional().nullable()
});

const byproductSaleSchema = z.object({
  item: z.string().min(1, "Byproduct sale item name is required"),
  price: z.coerce.number().nonnegative("Price must be 0 or greater"),
  harvest1Qty: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 1 byproduct quantity cannot be negative")),
  harvest1Sales: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 1 byproduct sales cannot be negative")),
  harvest2Qty: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 2 byproduct quantity cannot be negative")),
  harvest2Sales: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 2 byproduct sales cannot be negative")),
  harvest3Qty: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 3 byproduct quantity cannot be negative")),
  harvest3Sales: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Harvest 3 byproduct sales cannot be negative")),
  notes: z.string().optional().nullable()
});

const harvestEventSchema = z.object({
  harvestOrder: z.coerce.number().int().positive(),
  harvestDate: z.string().optional().nullable(),
  permitShipping: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Permit/shipping fee cannot be negative")),
  tollingFee: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Tolling fee cannot be negative")),
  notes: z.string().optional().nullable()
});

const financingItemSchema = z.object({
  description: z.string().min(1, "Financing description is required"),
  amount: z.coerce.number().nonnegative("Financing amount must be 0 or greater"),
  notes: z.string().optional().nullable()
});

export const harvestReportSchema = z.object({
  docAddOnRatePerBird: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("DOC add-on rate must be 0 or greater")),
  truckingFeePerBird: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().nonnegative("Trucking fee per bird must be 0 or greater")),
  chickenSales: z.array(chickenSaleSchema),
  byproductSales: z.array(byproductSaleSchema),
  harvestEvents: z.array(harvestEventSchema),
  financingItems: z.array(financingItemSchema)
});
