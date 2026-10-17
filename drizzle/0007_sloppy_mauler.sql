CREATE TYPE "public"."late_cancel_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "waitlisted_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "late_cancel_status" "late_cancel_status";--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "late_cancel_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "late_cancel_resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "late_cancel_resolved_by_id" text;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_late_cancel_resolved_by_id_users_id_fk" FOREIGN KEY ("late_cancel_resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;