CREATE TABLE `genealogy_records` (
	`person_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`parent_person_id` text,
	`parent_relation` text,
	`branch` text DEFAULT '' NOT NULL,
	`living` integer DEFAULT false NOT NULL,
	`minor` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`decision_id` text NOT NULL,
	`approved_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`biography` text DEFAULT '' NOT NULL,
	`skills` text DEFAULT '' NOT NULL,
	`volunteering` text DEFAULT '' NOT NULL,
	`show_city` integer DEFAULT false NOT NULL,
	`show_skills` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`nomination_id` text NOT NULL,
	`member_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'awaiting_provider' NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL,
	`sent_at` text,
	`accepted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_invitations_nomination_id_unique` ON `pending_invitations` (`nomination_id`);