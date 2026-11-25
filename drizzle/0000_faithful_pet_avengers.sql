CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`audience` text DEFAULT 'family' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`author_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`subject_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `genealogy_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`proposer_id` text NOT NULL,
	`branch` text NOT NULL,
	`person_ref` text NOT NULL,
	`proposed_change` text NOT NULL,
	`evidence` text NOT NULL,
	`level` text DEFAULT 'ordinary' NOT NULL,
	`branch_review` text DEFAULT '' NOT NULL,
	`independent_review_by` text,
	`independent_review_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'committee_review' NOT NULL,
	`decision_note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`event_date` text NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`author_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`branch` text DEFAULT '' NOT NULL,
	`person_ref` text,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`minor` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id_unique` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `nominations` (
	`id` text PRIMARY KEY NOT NULL,
	`proposer_id` text NOT NULL,
	`person_name` text NOT NULL,
	`person_ref` text NOT NULL,
	`branch` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`status` text DEFAULT 'nominated' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`branch` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_rsvps` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`response` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `genealogy_votes` (
	`correction_id` text NOT NULL,
	`member_user_id` text NOT NULL,
	`vote` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`correction_id`, `member_user_id`)
);
