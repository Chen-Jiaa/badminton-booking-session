CREATE TYPE "public"."ledger_type" AS ENUM('TOPUP', 'SESSION_DEBIT', 'MANUAL_ADJUST');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('PLAYER', 'HOST');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('YES', 'NO', 'WAITLIST');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('OPEN', 'LOCKED');--> statement-breakpoint
CREATE TYPE "public"."top_up_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "rsvp_status" DEFAULT 'YES' NOT NULL,
	"final_cost" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_session_user_unique" UNIQUE("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"map_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" text NOT NULL,
	"top_up_request_id" text,
	"session_id" text,
	CONSTRAINT "ledger_top_up_request_id_unique" UNIQUE("top_up_request_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"courts" integer DEFAULT 1 NOT NULL,
	"cost_per_court" numeric(10, 2) NOT NULL,
	"shuttle_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(10, 2),
	"cost_per_player" numeric(10, 2),
	"location" text,
	"location_map_url" text,
	"court_numbers" text,
	"max_players" integer DEFAULT 20 NOT NULL,
	"min_balance" numeric(10, 2) DEFAULT '20' NOT NULL,
	"status" "session_status" DEFAULT 'OPEN' NOT NULL,
	"rsvp_deadline" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"group_name" text DEFAULT 'Badminton Group' NOT NULL,
	"currency" text DEFAULT 'RM' NOT NULL,
	"default_session_day" text DEFAULT 'Thursday',
	"default_session_time" text DEFAULT '20:00',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_up_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"receipt_url" text,
	"status" "top_up_status" DEFAULT 'PENDING' NOT NULL,
	"reject_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"confirmed_by" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"image" text,
	"role" "role" DEFAULT 'PLAYER' NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fcm_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_top_up_request_id_top_up_requests_id_fk" FOREIGN KEY ("top_up_request_id") REFERENCES "public"."top_up_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up_requests" ADD CONSTRAINT "top_up_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendances_session_id_idx" ON "attendances" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attendances_user_id_idx" ON "attendances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_user_id_idx" ON "ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_session_id_idx" ON "ledger" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ledger_created_at_idx" ON "ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_start_time_idx" ON "sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "top_up_requests_user_id_idx" ON "top_up_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "top_up_requests_status_idx" ON "top_up_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");