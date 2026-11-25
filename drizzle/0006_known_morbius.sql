CREATE TABLE `tree_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`target_person_id` text,
	`parent_id` text,
	`fields_json` text DEFAULT '{}' NOT NULL,
	`base_revision` integer,
	`delegate_grant_id` text,
	`author_id` text NOT NULL,
	`source_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`applied_person_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tree_delegate_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`delegate_person_id` text NOT NULL,
	`scope_person_id` text NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_by` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `working_tree_people` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`gender` text DEFAULT 'male' NOT NULL,
	`birth_year` text DEFAULT '' NOT NULL,
	`death_year` text DEFAULT '' NOT NULL,
	`education` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`profession` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`source_note` text DEFAULT '' NOT NULL,
	`original_zone` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
