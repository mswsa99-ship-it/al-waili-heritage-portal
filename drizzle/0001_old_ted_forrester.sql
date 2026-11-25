CREATE TABLE `procedural_reviews` (
	`request_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`reviewer_role` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`request_id`, `reviewer_role`)
);
--> statement-breakpoint
CREATE TABLE `tree_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`records_json` text NOT NULL,
	`positions_json` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`editor_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `service_requests` ADD `parent_request_id` text;