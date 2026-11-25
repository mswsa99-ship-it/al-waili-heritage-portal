CREATE TABLE `lineage_work_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`event` text NOT NULL,
	`entity_id` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lineage_work_delegations` (
	`id` text PRIMARY KEY NOT NULL,
	`delegate_person_id` text NOT NULL,
	`root_person_id` text NOT NULL,
	`permissions_json` text DEFAULT '["add","edit","archive"]' NOT NULL,
	`status` text DEFAULT 'pending_activation' NOT NULL,
	`issued_by` text NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` text,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`delegate_person_id`) REFERENCES `working_tree_people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`root_person_id`) REFERENCES `working_tree_people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lineage_work_guard` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lineage_work_import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`checksum` text NOT NULL,
	`inserted_count` integer NOT NULL,
	`existing_count` integer NOT NULL,
	`conflicting_count` integer NOT NULL,
	`executed_by` text NOT NULL,
	`executed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lineage_work_photos` (
	`person_id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`base64_data` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `working_tree_people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lineage_work_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`person_id` text NOT NULL,
	`parent_id` text,
	`proposal_json` text NOT NULL,
	`expected_revision` integer,
	`grant_id` text,
	`author_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`grant_id`) REFERENCES `lineage_work_delegations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lineage_work_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`delegate_person_id` text NOT NULL,
	`root_person_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'complete_branch' NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'assigned' NOT NULL,
	`report` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`delegate_person_id`) REFERENCES `working_tree_people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`root_person_id`) REFERENCES `working_tree_people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `working_tree_people` ADD `reading_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `working_tree_people` ADD `review_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `working_tree_people` ADD `source_version` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER lineage_guard_assert BEFORE INSERT ON lineage_work_guard WHEN NEW.ok != 1 BEGIN SELECT RAISE(ABORT, 'CHECK stale lineage revision'); END;
--> statement-breakpoint
CREATE TRIGGER working_parent_insert BEFORE INSERT ON working_tree_people WHEN NEW.parent_id IS NOT NULL BEGIN
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM working_tree_people WHERE id=NEW.parent_id AND active=1) THEN RAISE(ABORT,'CHECK missing parent') END;
SELECT CASE WHEN NEW.parent_id=NEW.id THEN RAISE(ABORT,'CHECK lineage cycle') END;
END;
--> statement-breakpoint
CREATE TRIGGER working_parent_update BEFORE UPDATE OF parent_id,active ON working_tree_people BEGIN
SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM working_tree_people WHERE id=NEW.parent_id AND active=1) THEN RAISE(ABORT,'CHECK missing parent') END;
SELECT CASE WHEN NEW.active=0 AND EXISTS(SELECT 1 FROM working_tree_people WHERE parent_id=NEW.id AND active=1) THEN RAISE(ABORT,'CHECK active children') END;
SELECT CASE WHEN EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_id UNION SELECT p.parent_id FROM working_tree_people p JOIN ancestors a ON p.id=a.id WHERE p.parent_id IS NOT NULL) SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE(ABORT,'CHECK lineage cycle') END;
END;
--> statement-breakpoint
CREATE TRIGGER lineage_audit_no_update BEFORE UPDATE ON lineage_work_audit BEGIN SELECT RAISE(ABORT,'immutable audit'); END;
--> statement-breakpoint
CREATE TRIGGER lineage_audit_no_delete BEFORE DELETE ON lineage_work_audit BEGIN SELECT RAISE(ABORT,'immutable audit'); END;
