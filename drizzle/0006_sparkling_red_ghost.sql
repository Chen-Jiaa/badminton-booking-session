CREATE TYPE "public"."match_format" AS ENUM('SINGLES', 'DOUBLES');--> statement-breakpoint
CREATE TYPE "public"."match_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('INVITED', 'IN_PLAY', 'AWAITING_CONFIRM', 'CONFIRMED', 'DECLINED');--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"side" "match_side" NOT NULL,
	CONSTRAINT "match_players_match_user_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"format" "match_format" NOT NULL,
	"status" "match_status" NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"previous_score_a" integer,
	"previous_score_b" integer,
	"created_by_id" text NOT NULL,
	"submitted_by_id" text,
	"confirmed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_match_id_idx" ON "match_players" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_players_user_id_idx" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matches_session_id_idx" ON "matches" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");