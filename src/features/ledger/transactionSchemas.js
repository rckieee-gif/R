import { z } from 'zod';

export const transactionSchema = z.object({
  batchId: z.preprocess(
    (value) => (value === null || value === undefined ? '' : String(value).trim()),
    z.string().min(1, "Batch ID is required")
  ),
  date: z.string().min(1, "Date is required"),
  building: z.string().optional().nullable(),
  type: z.enum(['Income', 'Expense', 'Adjustment', 'Reimbursement', 'Payment'], {
    errorMap: () => ({ message: "Transaction type must be one of: Income, Expense, Adjustment, Reimbursement, Payment" })
  }),
  fundingNature: z.enum(['OPEX', 'CAPEX', 'CAPEX-Recoverable', 'Receivable', 'Payable', 'Revenue', 'Other Revenue'], {
    errorMap: () => ({ message: "Select a valid funding nature" })
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
