ALTER TYPE "public"."role" RENAME VALUE 'HOST' TO 'ADMIN';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'HOST';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "shuttle_count" integer DEFAULT 0 NOT NULL;
