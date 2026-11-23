CREATE TABLE `tradable_loaded` (
	`portfolio_id` integer PRIMARY KEY,
	`loaded_at` text NOT NULL,
	`isins` integer NOT NULL,
	CONSTRAINT `fk_tradable_loaded_portfolio_id_portfolios_id_fk` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tradable_stocks` (
	`portfolio_id` integer NOT NULL,
	`stock_id` text NOT NULL,
	CONSTRAINT `tradable_stocks_pk` PRIMARY KEY(`portfolio_id`, `stock_id`),
	CONSTRAINT `fk_tradable_stocks_portfolio_id_portfolios_id_fk` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_tradable_stocks_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE `unmatched_positions` (
	`portfolio_id` integer NOT NULL,
	`isin` text NOT NULL,
	`quantity` real NOT NULL,
	`value_eur` real,
	CONSTRAINT `unmatched_positions_pk` PRIMARY KEY(`portfolio_id`, `isin`),
	CONSTRAINT `fk_unmatched_positions_portfolio_id_portfolios_id_fk` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `portfolios` ADD `wikifolio` text;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `synced_at` text;