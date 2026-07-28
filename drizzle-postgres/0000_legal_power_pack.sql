CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"readiness_band" text,
	"submission_snapshot" text,
	"confirmation_number" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"detail" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"category" text NOT NULL,
	"statement" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"evidence" text DEFAULT '[]' NOT NULL,
	"sensitivity" text DEFAULT 'standard' NOT NULL,
	"allowed_uses" text DEFAULT '[]' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"processing_status" text DEFAULT 'stored' NOT NULL,
	"extracted_text" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"url" text NOT NULL,
	"deadline" timestamp with time zone,
	"eligibility" text DEFAULT '{}' NOT NULL,
	"ai_policy" text DEFAULT 'unknown' NOT NULL,
	"source_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "applications_user_updated_idx" ON "applications" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "applications_opportunity_idx" ON "applications" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "audit_user_created_idx" ON "audit_events" USING btree ("user_email","created_at");--> statement-breakpoint
CREATE INDEX "claims_user_updated_idx" ON "claims" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "documents_user_created_idx" ON "documents" USING btree ("user_email","created_at");--> statement-breakpoint
CREATE INDEX "opportunities_user_deadline_idx" ON "opportunities" USING btree ("user_email","deadline");