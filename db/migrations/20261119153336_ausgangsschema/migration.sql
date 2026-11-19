-- Ausgangsschema: der Stand vor Drizzle. IF NOT EXISTS (von Hand ergänzt), damit vorhandene
-- Datenbanken diese Migration ohne Änderung als angewendet übernehmen.
-- Überbleibsel der kurzzeitig genutzten dbmate-Buchführung.
DROP TABLE IF EXISTS `schema_migrations`;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dividends` (
	`stock_id` text NOT NULL,
	`date` text NOT NULL,
	`value` real NOT NULL,
	`currency` text NOT NULL,
	`period` text DEFAULT '' NOT NULL,
	CONSTRAINT `dividends_pk` PRIMARY KEY(`stock_id`, `date`),
	CONSTRAINT `fk_dividends_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fundamentals` (
	`stock_id` text NOT NULL,
	`fiscal_year` integer NOT NULL,
	`eps_diluted` real,
	`dividend_per_share` real,
	`shares` real,
	`repurchases` real,
	`issuance` real,
	`stock_based_compensation` real,
	`revenue` real,
	`ebit` real,
	`total_assets` real,
	`equity` real,
	`current_assets` real,
	`current_liabilities` real,
	`long_term_debt` real,
	`cash` real,
	`operating_cash_flow` real,
	`free_cash_flow` real,
	`net_debt` real,
	`interest_expense` real,
	`ebitda` real,
	`source` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fundamentals_pk` PRIMARY KEY(`stock_id`, `fiscal_year`),
	CONSTRAINT `fk_fundamentals_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fx_rates` (
	`date` text NOT NULL,
	`currency` text NOT NULL,
	`per_eur` real NOT NULL,
	CONSTRAINT `fx_rates_pk` PRIMARY KEY(`date`, `currency`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `history_loaded` (
	`stock_id` text NOT NULL,
	`kind` text NOT NULL,
	`fetched_at` text NOT NULL,
	CONSTRAINT `history_loaded_pk` PRIMARY KEY(`stock_id`, `kind`),
	CONSTRAINT `fk_history_loaded_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `holdings` (
	`portfolio_id` integer NOT NULL,
	`stock_id` text NOT NULL,
	`shares` real NOT NULL,
	CONSTRAINT `holdings_pk` PRIMARY KEY(`portfolio_id`, `stock_id`),
	CONSTRAINT `fk_holdings_portfolio_id_portfolios_id_fk` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_holdings_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `manual_inputs` (
	`stock_id` text NOT NULL,
	`key` text NOT NULL,
	`value` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `manual_inputs_pk` PRIMARY KEY(`stock_id`, `key`),
	CONSTRAINT `fk_manual_inputs_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `monthly_prices` (
	`stock_id` text NOT NULL,
	`month` text NOT NULL,
	`date` text NOT NULL,
	`close` real NOT NULL,
	`adjusted_close` real NOT NULL,
	CONSTRAINT `monthly_prices_pk` PRIMARY KEY(`stock_id`, `month`),
	CONSTRAINT `fk_monthly_prices_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `portfolio_snapshots` (
	`portfolio_id` integer NOT NULL,
	`date` text NOT NULL,
	`total_eur` real NOT NULL,
	`details` text NOT NULL,
	CONSTRAINT `portfolio_snapshots_pk` PRIMARY KEY(`portfolio_id`, `date`),
	CONSTRAINT `fk_portfolio_snapshots_portfolio_id_portfolios_id_fk` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `portfolios` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`profile` text NOT NULL,
	`cash_eur` real DEFAULT 0 NOT NULL,
	`other_eur` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prices` (
	`stock_id` text NOT NULL,
	`date` text NOT NULL,
	`close` real NOT NULL,
	CONSTRAINT `prices_pk` PRIMARY KEY(`stock_id`, `date`),
	CONSTRAINT `fk_prices_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `raw_documents` (
	`stock_id` text NOT NULL,
	`kind` text NOT NULL,
	`fetched_at` text NOT NULL,
	`body` text NOT NULL,
	CONSTRAINT `raw_documents_pk` PRIMARY KEY(`stock_id`, `kind`),
	CONSTRAINT `fk_raw_documents_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reference_rates` (
	`key` text PRIMARY KEY,
	`value` real NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `screening` (
	`stock_id` text PRIMARY KEY,
	`date` text NOT NULL,
	`price_date` text,
	`price` real,
	`payout_level` real,
	`growth` real,
	`risk_score` real NOT NULL,
	`inner_return` real,
	`implausible` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_screening_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `splits` (
	`stock_id` text NOT NULL,
	`date` text NOT NULL,
	`ratio` real NOT NULL,
	CONSTRAINT `splits_pk` PRIMARY KEY(`stock_id`, `date`),
	CONSTRAINT `fk_splits_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stocks` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`sector` text NOT NULL,
	`region` text NOT NULL,
	`country` text NOT NULL,
	`reporting_currency` text NOT NULL,
	`price_currency` text NOT NULL,
	`price_divisor` real DEFAULT 1 NOT NULL,
	`founded_year` integer,
	`is_financial` integer DEFAULT false NOT NULL,
	`watched` integer DEFAULT true NOT NULL,
	`security_type` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`finished_at` text NOT NULL,
	`ok` integer NOT NULL,
	`report` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `valuations` (
	`stock_id` text NOT NULL,
	`date` text NOT NULL,
	`complete` integer NOT NULL,
	`price` real,
	`risk_score` real NOT NULL,
	`inner_return` real,
	`inner_return_cautious` real,
	`inner_return_optimistic` real,
	`details` text NOT NULL,
	CONSTRAINT `valuations_pk` PRIMARY KEY(`stock_id`, `date`),
	CONSTRAINT `fk_valuations_stock_id_stocks_id_fk` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`)
);
