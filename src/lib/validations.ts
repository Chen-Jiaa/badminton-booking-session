import { z } from "zod";

export const topUpRequestSchema = z.object({
  amount: z.number().positive().multipleOf(0.01),
  receiptUrl: z.string().url().optional(),
});

export const withdrawalRequestSchema = z.discriminatedUnion("paymentMethod", [
  z.object({
    amount: z.number().positive().multipleOf(0.01),
    paymentMethod: z.literal("BANK"),
    bankName: z.string().min(1, "Bank name is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    note: z.string().optional(),
  }),
  z.object({
    amount: z.number().positive().multipleOf(0.01),
    paymentMethod: z.literal("DUITNOW"),
    duitnowPhone: z.string().min(1, "Phone number is required"),
    note: z.string().optional(),
  }),
]);

export const confirmTopUpSchema = z.object({
  requestId: z.string().min(1),
});

export const rejectTopUpSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "Rejection reason is required"),
});

export const createSessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  courts: z.number().int().positive(),
  costPerCourt: z.number().positive(),
  location: z.string().optional(),
  locationMapUrl: z.string().url().optional(),
  courtNumbers: z.string().optional(),
  maxPlayers: z.number().int().positive().default(20),
  minBalance: z.number().min(0).default(20),
  rsvpDeadline: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const updateSessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  courts: z.number().int().positive(),
  costPerCourt: z.number().positive(),
  location: z.string().optional(),
  locationMapUrl: z.string().url().optional().nullable(),
  courtNumbers: z.string().optional(),
  maxPlayers: z.number().int().positive(),
  minBalance: z.number().min(0),
  note: z.string().optional(),
  rsvpDeadline: z.string().datetime().optional().nullable(),
});

export const rsvpSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["YES", "NO", "WAITLIST"]),
});

export const manualAdjustSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().multipleOf(0.01),
  note: z.string().min(1, "Note is required for manual adjustments"),
});

export const lockSessionSchema = z.object({
  sessionId: z.string().min(1),
  shuttleCount: z.number().int().min(0),
  shuttleCost: z.number().min(0),
});

export const addPlayerSchema = z.object({
  userId: z.string().min(1),
});

export type TopUpRequestInput = z.infer<typeof topUpRequestSchema>;
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;
export type WithdrawalBankInput = Extract<WithdrawalRequestInput, { paymentMethod: "BANK" }>;
export type WithdrawalDuitnowInput = Extract<WithdrawalRequestInput, { paymentMethod: "DUITNOW" }>;
export type ConfirmTopUpInput = z.infer<typeof confirmTopUpSchema>;
export type RejectTopUpInput = z.infer<typeof rejectTopUpSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type ManualAdjustInput = z.infer<typeof manualAdjustSchema>;
export type LockSessionInput = z.infer<typeof lockSessionSchema>;
export type AddPlayerInput = z.infer<typeof addPlayerSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
