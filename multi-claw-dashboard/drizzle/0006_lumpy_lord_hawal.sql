CREATE TABLE `agent_registry_plugins` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`registry_plugin_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`installed_at` text,
	`updated_at` text,
	`error` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registry_plugin_id`) REFERENCES `plugin_registry`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plugin_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`version` text,
	`author` text,
	`repo_url` text,
	`type` text DEFAULT 'git-plugin' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_registry_slug_unique` ON `plugin_registry` (`slug`);