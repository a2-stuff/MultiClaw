CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`definition` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text REFERENCES `users`(`id`),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL REFERENCES `workflows`(`id`),
	`status` text DEFAULT 'running' NOT NULL,
	`input` text,
	`output` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_by` text REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_step_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL REFERENCES `workflow_runs`(`id`),
	`step_id` text NOT NULL,
	`agent_id` text REFERENCES `agents`(`id`),
	`task_id` text REFERENCES `agent_tasks`(`id`),
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text,
	`output` text,
	`started_at` text,
	`updated_at` text NOT NULL,
	`completed_at` text
);
