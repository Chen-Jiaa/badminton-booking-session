import {
  pgTable,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ENUMS
export const roleEnum = pgEnum("role", ["PLAYER", "HOST", "ADMIN"]);
export const topUpStatusEnum = pgEnum("top_up_status", ["PENDING", "CONFIRMED", "REJECTED"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
]);
export const withdrawalPaymentMethodEnum = pgEnum("withdrawal_payment_method", ["BANK", "DUITNOW"]);
export const ledgerTypeEnum = pgEnum("ledger_type", [
  "TOPUP",
  "SESSION_DEBIT",
  "MANUAL_ADJUST",
  "SESSION_DEPOSIT",
  "SESSION_REFUND",
  "WITHDRAWAL",
]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "COURT_RENTAL",
  "SHUTTLES",
  "OTHER",
]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["YES", "NO", "WAITLIST"]);
export const sessionStatusEnum = pgEnum("session_status", ["OPEN", "LOCKED"]);
export const matchFormatEnum = pgEnum("match_format", ["SINGLES", "DOUBLES"]);
// INVITED: waiting for an opponent to accept · IN_PLAY: accepted, no score yet ·
// AWAITING_CONFIRM: a score is in, the other side must confirm · CONFIRMED: counts ·
// DECLINED: turned down, or "we didn't play"
export const matchStatusEnum = pgEnum("match_status", [
  "INVITED",
  "IN_PLAY",
  "AWAITING_CONFIRM",
  "CONFIRMED",
  "DECLINED",
]);
export const matchSideEnum = pgEnum("match_side", ["A", "B"]);

// TABLES
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    email: text("email").unique(),
    phone: text("phone").unique(),
    image: text("image"),
    role: roleEnum("role").default("PLAYER").notNull(),
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
    duitnowPhone: text("duitnow_phone"),
    savedBankName: text("saved_bank_name"),
    savedAccountNumber: text("saved_account_number"),
    fcmToken: text("fcm_token"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    phoneIdx: index("users_phone_idx").on(table.phone),
  }),
);

export const topUpRequests = pgTable(
  "top_up_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    receiptUrl: text("receipt_url"),
    status: topUpStatusEnum("status").default("PENDING").notNull(),
    rejectReason: text("reject_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at"),
    confirmedBy: text("confirmed_by"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
  },
  (table) => ({
    userIdIdx: index("top_up_requests_user_id_idx").on(table.userId),
    statusIdx: index("top_up_requests_status_idx").on(table.status),
  }),
);

export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: withdrawalPaymentMethodEnum("payment_method"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    duitnowPhone: text("duitnow_phone"),
    note: text("note"),
    status: withdrawalStatusEnum("status").default("PENDING").notNull(),
    rejectReason: text("reject_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by"),
  },
  (table) => ({
    userIdIdx: index("withdrawal_requests_user_id_idx").on(table.userId),
    statusIdx: index("withdrawal_requests_status_idx").on(table.status),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    courts: integer("courts").default(1).notNull(),
    costPerCourt: decimal("cost_per_court", { precision: 10, scale: 2 }).notNull(),
    shuttleCount: integer("shuttle_count").default(0).notNull(),
    shuttleCost: decimal("shuttle_cost", { precision: 10, scale: 2 }).default("0").notNull(),
    totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
    costPerPlayer: decimal("cost_per_player", { precision: 10, scale: 2 }),
    location: text("location"),
    locationMapUrl: text("location_map_url"),
    courtNumbers: text("court_numbers"),
    courtsiteRef: text("courtsite_ref"),
    maxPlayers: integer("max_players").default(20).notNull(),
    minBalance: decimal("min_balance", { precision: 10, scale: 2 }).default("20").notNull(),
    status: sessionStatusEnum("status").default("OPEN").notNull(),
    rsvpDeadline: timestamp("rsvp_deadline"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    startTimeIdx: index("sessions_start_time_idx").on(table.startTime),
    statusIdx: index("sessions_status_idx").on(table.status),
  }),
);

export const ledger = pgTable(
  "ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: ledgerTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    topUpRequestId: text("top_up_request_id")
      .unique()
      .references(() => topUpRequests.id),
    withdrawalRequestId: text("withdrawal_request_id")
      .unique()
      .references(() => withdrawalRequests.id),
    sessionId: text("session_id").references(() => sessions.id),
  },
  (table) => ({
    userIdIdx: index("ledger_user_id_idx").on(table.userId),
    sessionIdIdx: index("ledger_session_id_idx").on(table.sessionId),
    createdAtIdx: index("ledger_created_at_idx").on(table.createdAt),
  }),
);

export const attendances = pgTable(
  "attendances",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: rsvpStatusEnum("status").default("YES").notNull(),
    finalCost: decimal("final_cost", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionUserUnique: unique("attendance_session_user_unique").on(table.sessionId, table.userId),
    sessionIdIdx: index("attendances_session_id_idx").on(table.sessionId),
    userIdIdx: index("attendances_user_id_idx").on(table.userId),
  }),
);

// Real cash paid out for a session (court rental, shuttles) or for the club in
// general. Distinct from `ledger`, which only tracks members' wallet credit.
export const expenses = pgTable(
  "expenses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id").references(() => sessions.id),
    category: expenseCategoryEnum("category").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    // null = recorded but not yet actually paid to the venue/vendor
    paidAt: timestamp("paid_at"),
    // who fronted the money out of their own pocket
    paidById: text("paid_by_id").references(() => users.id),
    reimbursed: boolean("reimbursed").default(false).notNull(),
    reimbursedAt: timestamp("reimbursed_at"),
    note: text("note"),
    receiptUrl: text("receipt_url"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    sessionIdIdx: index("expenses_session_id_idx").on(table.sessionId),
    paidAtIdx: index("expenses_paid_at_idx").on(table.paidAt),
    categoryIdx: index("expenses_category_idx").on(table.category),
  }),
);

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  groupName: text("group_name").default("Badminton Group").notNull(),
  currency: text("currency").default("RM").notNull(),
  defaultSessionDay: text("default_session_day").default("Thursday"),
  defaultSessionTime: text("default_session_time").default("20:00"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const courts = pgTable("courts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  mapUrl: text("map_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A game played during a session. Side A is always the recorder's side. Only
// CONFIRMED matches count towards stats and the leaderboard.
export const matches = pgTable(
  "matches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    format: matchFormatEnum("format").notNull(),
    status: matchStatusEnum("status").notNull(),
    // null until someone enters a result
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    // The score a dispute replaced, so both sides can see what changed
    previousScoreA: integer("previous_score_a"),
    previousScoreB: integer("previous_score_b"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    // Who entered the current score; someone on the other side has to confirm it
    submittedById: text("submitted_by_id").references(() => users.id),
    confirmedAt: timestamp("confirmed_at"),
    // Unanswered invites and results stop being actionable after this
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("matches_session_id_idx").on(table.sessionId),
    statusIdx: index("matches_status_idx").on(table.status),
  }),
);

export const matchPlayers = pgTable(
  "match_players",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    side: matchSideEnum("side").notNull(),
  },
  (table) => ({
    matchUserUnique: unique("match_players_match_user_unique").on(table.matchId, table.userId),
    matchIdIdx: index("match_players_match_id_idx").on(table.matchId),
    userIdIdx: index("match_players_user_id_idx").on(table.userId),
  }),
);

// RELATIONS
export const usersRelations = relations(users, ({ many }) => ({
  ledgerEntries: many(ledger, { relationName: "userLedger" }),
  createdLedgers: many(ledger, { relationName: "ledgerCreator" }),
  topUpRequests: many(topUpRequests),
  withdrawalRequests: many(withdrawalRequests),
  attendances: many(attendances),
  createdSessions: many(sessions),
  paidExpenses: many(expenses, { relationName: "expensePayer" }),
  createdExpenses: many(expenses, { relationName: "expenseCreator" }),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  user: one(users, {
    fields: [withdrawalRequests.userId],
    references: [users.id],
  }),
}));

export const topUpRequestsRelations = relations(topUpRequests, ({ one }) => ({
  user: one(users, {
    fields: [topUpRequests.userId],
    references: [users.id],
  }),
  ledgerEntry: one(ledger),
}));

export const ledgerRelations = relations(ledger, ({ one }) => ({
  user: one(users, {
    fields: [ledger.userId],
    references: [users.id],
    relationName: "userLedger",
  }),
  createdBy: one(users, {
    fields: [ledger.createdById],
    references: [users.id],
    relationName: "ledgerCreator",
  }),
  topUpRequest: one(topUpRequests, {
    fields: [ledger.topUpRequestId],
    references: [topUpRequests.id],
  }),
  withdrawalRequest: one(withdrawalRequests, {
    fields: [ledger.withdrawalRequestId],
    references: [withdrawalRequests.id],
  }),
  session: one(sessions, {
    fields: [ledger.sessionId],
    references: [sessions.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  session: one(sessions, {
    fields: [expenses.sessionId],
    references: [sessions.id],
    relationName: "sessionExpenses",
  }),
  paidBy: one(users, {
    fields: [expenses.paidById],
    references: [users.id],
    relationName: "expensePayer",
  }),
  createdBy: one(users, {
    fields: [expenses.createdById],
    references: [users.id],
    relationName: "expenseCreator",
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [sessions.createdById],
    references: [users.id],
  }),
  attendances: many(attendances),
  ledgerEntries: many(ledger),
  expenses: many(expenses, { relationName: "sessionExpenses" }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  session: one(sessions, {
    fields: [matches.sessionId],
    references: [sessions.id],
  }),
  players: many(matchPlayers),
}));

export const matchPlayersRelations = relations(matchPlayers, ({ one }) => ({
  match: one(matches, {
    fields: [matchPlayers.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [matchPlayers.userId],
    references: [users.id],
  }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  session: one(sessions, {
    fields: [attendances.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [attendances.userId],
    references: [users.id],
  }),
}));

export const courtsRelations = relations(courts, () => ({}));

// TYPES
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type TopUpRequest = typeof topUpRequests.$inferSelect;
export type NewTopUpRequest = typeof topUpRequests.$inferInsert;
export type Ledger = typeof ledger.$inferSelect;
export type NewLedger = typeof ledger.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Attendance = typeof attendances.$inferSelect;
export type NewAttendance = typeof attendances.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type Court = typeof courts.$inferSelect;
export type NewCourt = typeof courts.$inferInsert;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type NewWithdrawalRequest = typeof withdrawalRequests.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
