ALTER TABLE `heritage_items` ADD `source_author` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `heritage_items` ADD `source_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `heritage_items` ADD `source_page` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `heritage_items` ADD `evidence_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `heritage_items` ADD `attachment_id` text;