import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  headline: text("headline").notNull().default(""),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const extensionTokens = pgTable(
  "extension_tokens",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label").notNull().default("Chrome extension"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("extension_tokens_user_idx").on(table.userEmail)],
);

export const claims = pgTable(
  "claims",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    category: text("category").notNull(),
    statement: text("statement").notNull(),
    status: text("status", {
      enum: ["verified", "draft", "inference", "restricted", "missing"],
    })
      .notNull()
      .default("draft"),
    evidence: text("evidence").notNull().default("[]"),
    sensitivity: text("sensitivity", {
      enum: ["standard", "sensitive"],
    })
      .notNull()
      .default("standard"),
    allowedUses: text("allowed_uses").notNull().default("[]"),
    confidence: integer("confidence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("claims_user_updated_idx").on(table.userEmail, table.updatedAt)],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    url: text("url").notNull(),
    deadline: timestamp("deadline", { withTimezone: true }),
    eligibility: text("eligibility").notNull().default("{}"),
    aiPolicy: text("ai_policy").notNull().default("unknown"),
    sourceText: text("source_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("opportunities_user_deadline_idx").on(table.userEmail, table.deadline),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    status: text("status", {
      enum: ["planning", "drafting", "review", "submitted", "withdrawn"],
    })
      .notNull()
      .default("planning"),
    readinessBand: text("readiness_band", {
      enum: ["not_ready", "developing", "plausible", "competitive", "standout"],
    }),
    submissionSnapshot: text("submission_snapshot"),
    confirmationNumber: text("confirmation_number"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("applications_user_updated_idx").on(table.userEmail, table.updatedAt),
    index("applications_opportunity_idx").on(table.opportunityId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    detail: text("detail").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("audit_user_created_idx").on(table.userEmail, table.createdAt)],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    processingStatus: text("processing_status", {
      enum: ["stored", "extracting", "ready", "failed"],
    })
      .notNull()
      .default("stored"),
    extractedText: text("extracted_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("documents_user_created_idx").on(table.userEmail, table.createdAt)],
);

export const fitAnalyses = pgTable(
  "fit_analyses",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    target: text("target").notNull(),
    score: integer("score").notNull(),
    readinessBand: text("readiness_band", {
      enum: ["not_ready", "developing", "plausible", "competitive", "standout"],
    }).notNull(),
    analysis: text("analysis").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("fit_analyses_user_updated_idx").on(table.userEmail, table.updatedAt)],
);

export const stories = pgTable(
  "stories",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    title: text("title").notNull(),
    lens: text("lens").notNull(),
    situation: text("situation").notNull().default(""),
    action: text("action").notNull().default(""),
    result: text("result").notNull().default(""),
    reflection: text("reflection").notNull().default(""),
    sourceClaimIds: text("source_claim_ids").notNull().default("[]"),
    status: text("status", { enum: ["draft", "approved"] }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("stories_user_updated_idx").on(table.userEmail, table.updatedAt)],
);

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    target: text("target").notNull(),
    questions: text("questions").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("interview_sessions_user_updated_idx").on(table.userEmail, table.updatedAt)],
);
