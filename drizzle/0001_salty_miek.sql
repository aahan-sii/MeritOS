CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`processing_status` text DEFAULT 'stored' NOT NULL,
	`extracted_text` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `documents_user_created_idx` ON `documents` (`user_email`,`created_at`);