ALTER TABLE `agents` ADD `default_provider` text DEFAULT 'anthropic' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `default_model` text DEFAULT 'claude-sonnet-4-6' NOT NULL;