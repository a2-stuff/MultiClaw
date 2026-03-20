CREATE TABLE `skill_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`api_base_url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `skills` ADD `source` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `source_slug` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `provider_id` text REFERENCES skill_providers(id);--> statement-breakpoint
INSERT INTO skill_providers (id, name, type, api_base_url, enabled, created_at)
VALUES ('clawhub-default', 'ClawHub', 'clawhub', 'https://wry-manatee-359.convex.site/api/v1', 1, datetime('now'));