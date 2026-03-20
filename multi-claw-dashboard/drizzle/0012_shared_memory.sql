CREATE TABLE `shared_state` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`embedding` text,
	`metadata` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
