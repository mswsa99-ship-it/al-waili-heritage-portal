CREATE TABLE `council_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`held_at` text NOT NULL,
	`minutes` text NOT NULL,
	`decisions` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`author_id` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`starts_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_invite_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_by` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_invite_tokens_token_hash_unique` ON `member_invite_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `private_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`inquiry_id` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `program_participants` (
	`program_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`program_id`, `user_id`),
	FOREIGN KEY (`program_id`) REFERENCES `family_programs`(`id`) ON UPDATE no action ON DELETE no action
);
