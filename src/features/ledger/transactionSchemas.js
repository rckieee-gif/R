import { z } from 'zod';

export const transactionSchema = z.object({
  batchId: z.coerce.number().int().positive("Batch ID must be positive"),
  date: z.string().min(1, "Date is required"),
  building: z.string().optional().nullable(),
  type: z.enum(['Income', 'Expense', 'Adjustment', 'Reimbursement', 'Payment'], {
    errorMap: () => ({ message: "Transaction type must be one of: Income, Expense, Adjustment, Reimbursement, Payment" })
  }),
  fundingNature: z.enum(['OPEX', 'CAPEX', 'CAPEX-Recoverable', 'Revenue'], {
    errorMap: () => ({ message: "Funding nature must be one of: OPEX, CAPEX, CAPEX-Recoverable, Revenue" })
  }),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? undefined : Number(val),
    z.number().positive("Quantity must be greater than zero").optional()
  ),
  unitCost: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? undefined : Number(val),
    z.number().positive("Unit cost must be greater than zero").optional()
  ),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidBy: z.string().min(1, "Paid by is required"),
  paidTo: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  feedItemId: z.preprocess(
    (val) => (val === '' || val === undefined || val === null) ? null : Number(val),
    z.number().int().positive().nullable().optional()
  )
});
