CREATE TABLE `gallery_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gallery_history` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gallery_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `gallery_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_photos_storage_key_unique` ON `gallery_photos` (`storage_key`);--> statement-breakpoint
CREATE TABLE `gallery_staff` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`updated_at` text NOT NULL
);
