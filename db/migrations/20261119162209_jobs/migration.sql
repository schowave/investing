CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`kind` text NOT NULL,
	`args` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`progress_done` integer,
	`progress_total` integer,
	`log` text DEFAULT '' NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE INDEX `jobs_status` ON `jobs` (`status`);