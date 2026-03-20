ALTER TABLE agents ADD COLUMN spawned_locally integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE agents ADD COLUMN spawn_pid integer;--> statement-breakpoint
ALTER TABLE agents ADD COLUMN spawn_port integer;--> statement-breakpoint
ALTER TABLE agents ADD COLUMN spawn_dir text;--> statement-breakpoint
ALTER TABLE agents ADD COLUMN spawn_host text;
