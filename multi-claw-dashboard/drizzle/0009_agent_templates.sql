CREATE TABLE `agent_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`provider` text,
	`model` text,
	`system_prompt` text,
	`skills` text,
	`plugins` text,
	`env_vars` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_templates_name_unique` ON `agent_templates` (`name`);--> statement-breakpoint
ALTER TABLE `agents` ADD `template_id` text REFERENCES agent_templates(id);