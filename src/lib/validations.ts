import { z } from "zod";
import { toWhatsAppNumber } from "@/lib/phone";

export const topUpRequestSchema = z.object({
  amount: z.number().positive().multipleOf(0.01),
  // Storage path returned by /api/upload; checked against the caller in createTopUpFn
  receiptPath: z.string().max(200).optional(),
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

export const rejectWithdrawalSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "Rejection reason is required"),
});

export const createExpenseSchema = z.object({
  category: z.enum(["COURT_RENTAL", "SHUTTLES", "OTHER"]),
  amount: z.number().positive().multipleOf(0.01),
  sessionId: z.string().min(1).optional(),
  paidAt: z.string().datetime().optional(),
  note: z.string().optional(),
  receiptUrl: z.string().url().optional(),
});

export const updateExpenseSchema = z.object({
  expenseId: z.string().min(1),
  category: z.enum(["COURT_RENTAL", "SHUTTLES", "OTHER"]),
  amount: z.number().positive().multipleOf(0.01),
  note: z.string().optional(),
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

export const resolveLateCancelSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  // Waitlisted player to take the spot when approving; omit to leave it open
  replacementUserId: z.string().min(1).nullish(),
});

export const promoteWaitlistSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
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
  /**
   * Who supplied the shuttles. `null` means club stock — already accounted for
   * when the bulk purchase was recorded, so the per-session charge is pure
   * recovery and must NOT create a second expense. A user id means that person
   * brought their own, which is real unrecorded spend owed back to them.
   */
  shuttleSupplierId: z.string().min(1).nullable().optional(),
});

export const addPlayerSchema = z.object({
  userId: z.string().min(1),
});

const matchScore = z.number().int().min(0).max(30);

export const createMatchSchema = z
  .object({
    sessionId: z.string().min(1),
    format: z.enum(["SINGLES", "DOUBLES"]),
    partnerId: z.string().min(1).nullable(),
    opponentIds: z.array(z.string().min(1)).min(1).max(2),
    // null: not played yet, the match goes out as an invite
    score: z.tuple([matchScore, matchScore]).nullable(),
  })
  .refine(
    (d) =>
      d.format === "SINGLES"
        ? d.partnerId === null && d.opponentIds.length === 1
        : d.partnerId !== null && d.opponentIds.length === 2,
    { message: "Wrong number of players for the format" },
  );

export const submitMatchResultSchema = z.object({
  matchId: z.string().min(1),
  // enter: first score for a match in play · dispute: replace a score you disagree with
  mode: z.enum(["enter", "dispute"]),
  scoreA: matchScore,
  scoreB: matchScore,
});

export const respondToMatchSchema = z.object({
  matchId: z.string().min(1),
  // accept/decline an invite · confirm a result · decline a result as "we didn't play"
  action: z.enum(["accept", "decline", "confirm"]),
});

export const deleteMatchSchema = z.object({
  matchId: z.string().min(1),
});

export type TopUpRequestInput = z.infer<typeof topUpRequestSchema>;
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;
export type WithdrawalBankInput = Extract<WithdrawalRequestInput, { paymentMethod: "BANK" }>;
export type WithdrawalDuitnowInput = Extract<WithdrawalRequestInput, { paymentMethod: "DUITNOW" }>;
export type ConfirmTopUpInput = z.infer<typeof confirmTopUpSchema>;
export type RejectTopUpInput = z.infer<typeof rejectTopUpSchema>;
export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type ManualAdjustInput = z.infer<typeof manualAdjustSchema>;
export type LockSessionInput = z.infer<typeof lockSessionSchema>;
export type AddPlayerInput = z.infer<typeof addPlayerSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type SubmitMatchResultInput = z.infer<typeof submitMatchResultSchema>;
export type RespondToMatchInput = z.infer<typeof respondToMatchSchema>;
export type DeleteMatchInput = z.infer<typeof deleteMatchSchema>;

// Empty clears the number
export const updatePhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || toWhatsAppNumber(v) !== null, "Enter a valid phone number"),
});
