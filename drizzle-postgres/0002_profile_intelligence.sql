CREATE TABLE "fit_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"target" text NOT NULL,
	"score" integer NOT NULL,
	"readiness_band" text NOT NULL,
	"analysis" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"target" text NOT NULL,
	"questions" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"title" text NOT NULL,
	"lens" text NOT NULL,
	"situation" text DEFAULT '' NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"reflection" text DEFAULT '' NOT NULL,
	"source_claim_ids" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fit_analyses_user_updated_idx" ON "fit_analyses" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "interview_sessions_user_updated_idx" ON "interview_sessions" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "stories_user_updated_idx" ON "stories" USING btree ("user_email","updated_at");