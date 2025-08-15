
import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  to: z.string().min(42),
  amountUsdc: z.string().regex(/^\d+(\.\d+)?$/),
  memo: z.string().optional()
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
