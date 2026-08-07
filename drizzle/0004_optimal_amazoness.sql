CREATE TYPE "public"."expense_category" AS ENUM('COURT_RENTAL', 'SHUTTLES', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."ledger_type" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"category" "expense_category" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" timestamp,
	"paid_by_id" text,
	"reimbursed" boolean DEFAULT false NOT NULL,
	"reimbursed_at" timestamp,
	"note" text,
	"receipt_url" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger" ADD COLUMN "withdrawal_request_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_session_id_idx" ON "expenses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "expenses_paid_at_idx" ON "expenses" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_withdrawal_request_id_withdrawal_requests_id_fk" FOREIGN KEY ("withdrawal_request_id") REFERENCES "public"."withdrawal_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_withdrawal_request_id_unique" UNIQUE("withdrawal_request_id");
