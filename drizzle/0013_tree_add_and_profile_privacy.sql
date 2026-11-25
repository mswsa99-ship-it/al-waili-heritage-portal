ALTER TABLE `member_profiles` ADD `show_biography` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `member_profiles` ADD `show_volunteering` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `member_data_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`redeemed_at` text,
	`completed_at` text,
	`expires_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `member_data_invites_token_hash_unique` ON `member_data_invites` (`token_hash`);
