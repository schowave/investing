PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_raw_documents` (
	`stock_id` text NOT NULL,
	`kind` text NOT NULL,
	`fetched_at` text NOT NULL,
	`body` blob NOT NULL,
	CONSTRAINT `raw_documents_pk` PRIMARY KEY(`stock_id`, `kind`),
	CONSTRAINT `fk_raw_documents_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_raw_documents`(`stock_id`, `kind`, `fetched_at`, `body`) SELECT `stock_id`, `kind`, `fetched_at`, `body` FROM `raw_documents`;--> statement-breakpoint
DROP TABLE `raw_documents`;--> statement-breakpoint
ALTER TABLE `__new_raw_documents` RENAME TO `raw_documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `raw_documents_kind` ON `raw_documents` (`kind`);--> statement-breakpoint
CREATE INDEX `fx_rates_currency_date` ON `fx_rates` (`currency`,`date`);--> statement-breakpoint
CREATE INDEX `history_loaded_kind` ON `history_loaded` (`kind`);--> statement-breakpoint
CREATE INDEX `screening_inner_return` ON `screening` (`inner_return`);