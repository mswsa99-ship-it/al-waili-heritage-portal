CREATE TABLE `direct_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`person_id` text NOT NULL,
	`channel` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'awaiting_provider' NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_enrollments_member_id_unique` ON `direct_enrollments` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `direct_enrollments_person_id_unique` ON `direct_enrollments` (`person_id`);--> statement-breakpoint
CREATE TABLE `family_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`person_id` text NOT NULL,
	`branch` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`response_note` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_poll_votes` (
	`poll_id` text NOT NULL,
	`user_id` text NOT NULL,
	`option_index` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`poll_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `family_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`options_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`closes_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`member_report` text DEFAULT '' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`assigned_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
